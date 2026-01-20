import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { list } from '@vercel/blob';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const METADATA_FILE = path.join(process.cwd(), 'public', 'uploads', 'metadata.json');
const METADATA_BLOB_NAME = 'metadata.json';
const IS_VERCEL = process.env.VERCEL === '1';

const ALLOWED_EXTENSIONS = [
    '.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi', '.flv', '.mpeg', '.mpg',
    '.mp3', '.wav', '.m4a', '.aac'
];

interface MediaMetadata {
    filename: string;
    mediaUrl?: string;
    youtubeUrl?: string;
    title?: string;
    description?: string;
    type?: 'video' | 'audio' | 'youtube';
}

function isValidMediaFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
}

async function loadMetadata(): Promise<Record<string, MediaMetadata>> {
    try {
        if (IS_VERCEL) {
            if (!process.env.BLOB_READ_WRITE_TOKEN) return {};
            try {
                const blobs = await list({ prefix: METADATA_BLOB_NAME, limit: 1 });
                if (blobs.blobs.length > 0) {
                    const response = await fetch(blobs.blobs[0].url);
                    if (response.ok) return await response.json();
                }
            } catch (error) {
                console.error('Error loading metadata from blob:', error);
            }
            return {};
        } else {
            if (existsSync(METADATA_FILE)) {
                const content = await readFile(METADATA_FILE, 'utf-8');
                return JSON.parse(content);
            }
        }
    } catch (error) {
        console.error('Error loading metadata:', error);
    }
    return {};
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const metadata = await loadMetadata();
        let mediaFiles: any[] = [];

        if (IS_VERCEL) {
            if (!process.env.BLOB_READ_WRITE_TOKEN) {
                return NextResponse.json({ success: true, count: 0, media: [] });
            }
            try {
                let allBlobs: any[] = [];
                let cursor: string | undefined = undefined;

                do {
                    const result: { blobs: any[]; cursor?: string } = await list({ limit: 1000, cursor });
                    allBlobs = allBlobs.concat(result.blobs);
                    cursor = result.cursor;
                } while (cursor);

                mediaFiles = allBlobs
                    .filter(blob => {
                        const ext = path.extname(blob.pathname).toLowerCase();
                        return ALLOWED_EXTENSIONS.includes(ext);
                    })
                    .map(blob => {
                        const fullPathname = blob.pathname.split('/').pop() || blob.pathname;

                        // Handle Vercel suffix (same logic as root)
                        let filename = fullPathname;
                        const ext = path.extname(filename).toLowerCase();
                        const baseName = path.basename(filename, ext);
                        if (baseName.includes('-')) {
                            const parts = baseName.split('-');
                            const lastPart = parts[parts.length - 1];
                            if (lastPart && lastPart.length === 32 && /^[a-zA-Z0-9]+$/.test(lastPart)) {
                                filename = parts.slice(0, -1).join('-') + ext;
                            }
                        }

                        const isAudio = ['.mp3', '.wav', '.m4a', '.aac'].includes(ext);
                        const fileMetadata = metadata[filename] || metadata[fullPathname] || {};

                        return {
                            filename: filename,
                            url: blob.url,
                            video_url: `/videos/${filename}`,
                            title: fileMetadata.title || filename.replace(ext, '').replace(/_/g, ' ').trim() || 'Untitled',
                            description: fileMetadata.description || '',
                            type: isAudio ? 'audio' : 'video',
                            size: (blob as any).size || null,
                            uploadedAt: (blob as any).uploadedAt || null,
                        };
                    });

                // Add virtual YouTube items
                const youtubeItems = Object.values(metadata)
                    .filter(m => m.type === 'youtube' && m.youtubeUrl)
                    .map(m => {
                        // Find the thumbnail blob for this YouTube item
                        const thumbBlob = allBlobs.find(b => {
                            const bPath = b.pathname.split('/').pop() || '';
                            return bPath === m.filename || bPath.startsWith(m.filename.split('.')[0]);
                        });

                        return {
                            filename: m.filename,
                            youtube_video_url: m.youtubeUrl,
                            video_url: `/videos/${m.filename}`,
                            title: m.title || 'YouTube Video',
                            description: m.description || '',
                            type: 'youtube',
                            uploadedAt: null,
                        };
                    });

                mediaFiles = [...mediaFiles, ...youtubeItems];

            } catch (error) {
                return NextResponse.json({ success: false, count: 0, media: [], error: 'Failed to list media' });
            }
        } else {
            if (existsSync(UPLOAD_DIR)) {
                const files = await readdir(UPLOAD_DIR);
                mediaFiles = files
                    .filter(file => isValidMediaFile(file))
                    .map(file => {
                        const filePath = path.join(UPLOAD_DIR, file);
                        const stats = existsSync(filePath) ? require('fs').statSync(filePath) : null;
                        const ext = path.extname(file).toLowerCase();
                        const isAudio = ['.mp3', '.wav', '.m4a', '.aac'].includes(ext);
                        const fileMetadata = metadata[file] || {};

                        return {
                            filename: file,
                            url: `/api/videos/${file}`,
                            video_url: `/videos/${file}`,
                            title: fileMetadata.title || file.replace(ext, '').replace(/_/g, ' ').trim() || 'Untitled',
                            description: fileMetadata.description || '',
                            type: isAudio ? 'audio' : 'video',
                            size: stats ? stats.size : null,
                            uploadedAt: stats ? stats.mtime.toISOString() : null,
                        };
                    });

                // Add virtual YouTube items for local
                const youtubeItems = Object.values(metadata)
                    .filter(m => m.type === 'youtube' && m.youtubeUrl)
                    .map(m => {
                        return {
                            filename: m.filename,
                            youtube_video_url: m.youtubeUrl,
                            video_url: `/videos/${m.filename}`,
                            title: m.title || 'YouTube Video',
                            description: m.description || '',
                            type: 'youtube',
                            uploadedAt: null,
                        };
                    });

                mediaFiles = [...mediaFiles, ...youtubeItems];
            }
        }

        mediaFiles.sort((a, b) => a.title.localeCompare(b.title));

        return NextResponse.json({ success: true, count: mediaFiles.length, media: mediaFiles });
    } catch (error) {
        console.error('Error fetching media:', error);
        return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
    }
}
