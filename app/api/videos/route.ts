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
    uploadedAt?: string;
}

function isValidMediaFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
}

function formatToIST(dateInput: any): string | null {
    if (!dateInput) return null;
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return String(dateInput);

        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(date).replace(',', '');
    } catch {
        return String(dateInput);
    }
}

function getISTTimestamp(): string {
    return formatToIST(new Date()) || '';
}

async function loadMetadata(): Promise<Record<string, MediaMetadata> | null> {
    try {
        if (IS_VERCEL) {
            if (!process.env.BLOB_READ_WRITE_TOKEN) return {};
            try {
                const blobs = await list({ prefix: METADATA_BLOB_NAME, limit: 1 });
                if (blobs.blobs.length > 0) {
                    // Active Cache-Busting: Append current timestamp to force bypass CDN cache
                    const cacheBuster = `?t=${Date.now()}`;
                    const response = await fetch(blobs.blobs[0].url + cacheBuster, { cache: 'no-store' });

                    if (response.ok) return await response.json();
                    if (response.status === 404) return {};

                    console.error(`Metadata fetch failed: ${response.status} ${response.statusText}`);
                    return null;
                }
                return {};
            } catch (error) {
                console.error('Error listing/fetching metadata from blob:', error);
                return null;
            }
        } else {
            if (existsSync(METADATA_FILE)) {
                const content = await readFile(METADATA_FILE, 'utf-8');
                return JSON.parse(content);
            }
            return {};
        }
    } catch (error) {
        console.error('Error loading metadata:', error);
        return null;
    }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const metadataResult = await loadMetadata();
        if (metadataResult === null) {
            console.error('Metadata failed to load. Aborting to prevent data corruption.');
            // Fallback to empty if we can't load, but we should be careful
            // Actually, for listing, it's safer to show what we have (blobs) even if metadata titles are missing
        }
        const metadata = metadataResult || {};
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
                        const baseNameNoExt = path.basename(filename, ext);
                        if (baseNameNoExt.includes('-')) {
                            const parts = baseNameNoExt.split('-');
                            const lastPart = parts[parts.length - 1];
                            if (lastPart && lastPart.length === 32 && /^[a-zA-Z0-9]+$/.test(lastPart)) {
                                filename = parts.slice(0, -1).join('-') + ext;
                            }
                        }

                        const isAudio = ['.mp3', '.wav', '.m4a', '.aac'].includes(ext);

                        // Robust Metadata Matching
                        let fileMetadata = metadata[filename] || metadata[fullPathname] || {};

                        if (!fileMetadata.title || fileMetadata.title === 'Untitled') {
                            const strippedBase = filename.replace(ext, '').toLowerCase();
                            const matchingKey = Object.keys(metadata).find(key => {
                                const keyBase = key.replace(path.extname(key), '').toLowerCase();
                                return keyBase === strippedBase || keyBase.includes(strippedBase) || strippedBase.includes(keyBase);
                            });
                            if (matchingKey) {
                                fileMetadata = { ...fileMetadata, ...metadata[matchingKey] };
                            }
                        }

                        return {
                            filename: filename,
                            url: blob.url,
                            video_url: `/videos/${filename}`,
                            title: fileMetadata.title || filename.replace(ext, '').replace(/_/g, ' ').trim() || 'Untitled',
                            description: fileMetadata.description || (isAudio ? 'Audio file' : 'Video file'),
                            type: fileMetadata.type || (isAudio ? 'audio' : 'video'),
                            size: (blob as any).size || null,
                            uploadedAt: formatToIST(fileMetadata.uploadedAt || (blob as any).uploadedAt),
                        };
                    });

                // Add virtual YouTube items
                const youtubeItems = Object.values(metadata)
                    .filter(m => m.type === 'youtube' && m.youtubeUrl)
                    .map(m => {
                        // Find the thumbnail blob for this YouTube item
                        const thumbBlob = allBlobs.find(b => {
                            const bPath = b.pathname.split('/').pop() || '';
                            const bBase = bPath.split('.')[0].toLowerCase();
                            const mBase = m.filename.split('.')[0].toLowerCase();
                            return bPath === m.filename || bBase === mBase || bBase.includes(mBase) || mBase.includes(bBase);
                        });

                        return {
                            filename: m.filename,
                            youtube_video_url: m.youtubeUrl,
                            video_url: `/videos/${m.filename}`,
                            title: m.title || 'YouTube Video',
                            description: m.description || '',
                            type: 'youtube',
                            uploadedAt: m.uploadedAt || null,
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
                            uploadedAt: formatToIST(fileMetadata.uploadedAt || (stats ? stats.mtime : null)),
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
                            uploadedAt: m.uploadedAt || null,
                        };
                    });

                mediaFiles = [...mediaFiles, ...youtubeItems];
            }
        }

        // Sort by upload date (newest first)
        mediaFiles.sort((a, b) => {
            const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
            const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
            return dateB - dateA;
        });

        return NextResponse.json({
            success: true,
            count: mediaFiles.length,
            media: mediaFiles
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (error) {
        console.error('Error fetching media:', error);
        return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
    }
}
