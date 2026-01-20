import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { list, del } from '@vercel/blob';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const METADATA_FILE = path.join(process.cwd(), 'public', 'uploads', 'metadata.json');
const METADATA_BLOB_NAME = 'metadata.json';
const IS_VERCEL = process.env.VERCEL === '1';

const ALLOWED_EXTENSIONS = [
    '.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi', '.flv', '.mpeg', '.mpg',
    '.mp3', '.wav', '.m4a', '.aac', '.jpg', '.jpeg', '.png', '.webp' // Including thumbnails
];

interface MediaMetadata {
    filename: string;
    mediaUrl?: string;
    youtubeUrl?: string;
    title?: string;
    type?: 'video' | 'audio' | 'youtube';
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

async function saveMetadata(metadata: Record<string, MediaMetadata>): Promise<void> {
    try {
        if (IS_VERCEL) {
            const { put } = await import('@vercel/blob');
            await put(METADATA_BLOB_NAME, JSON.stringify(metadata, null, 2), {
                access: 'public',
                contentType: 'application/json',
                addRandomSuffix: false,
            });
        } else {
            const dir = path.dirname(METADATA_FILE);
            if (!existsSync(dir)) await mkdir(dir, { recursive: true });
            const { writeFile } = await import('fs/promises');
            await writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
        }
    } catch (error) {
        console.error('Error saving metadata:', error);
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { filename: string } }
) {
    try {
        const filename = params.filename;
        if (!filename) {
            return NextResponse.json({ error: 'Filename required' }, { status: 400 });
        }

        const metadata = await loadMetadata();
        const itemMetadata = metadata[filename];
        const isThumbRequest = request.nextUrl.searchParams.get('thumb') === 'true';

        if (itemMetadata && itemMetadata.type === 'youtube' && itemMetadata.youtubeUrl) {
            if (!isThumbRequest) {
                return NextResponse.redirect(itemMetadata.youtubeUrl);
            }
        }

        if (IS_VERCEL) {
            let allBlobs: any[] = [];
            let cursor: string | undefined = undefined;

            do {
                const result: { blobs: any[]; cursor?: string } = await list({ limit: 1000, cursor });
                allBlobs = allBlobs.concat(result.blobs);
                cursor = result.cursor;
            } while (cursor);

            const decodedFilename = decodeURIComponent(filename);
            const blob = allBlobs.find((b: any) => {
                const blobFilename = b.pathname.split('/').pop() || b.pathname;
                return blobFilename === decodedFilename || blobFilename === filename;
            });

            if (blob && blob.url) {
                return NextResponse.redirect(blob.url);
            }
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const filePath = path.join(UPLOAD_DIR, filename);
        if (!existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const fileBuffer = await readFile(filePath);
        const ext = path.extname(filename).toLowerCase();

        const contentType = ext === '.mp4' ? 'video/mp4' :
            ext === '.mp3' ? 'audio/mpeg' :
                ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                    ext === '.png' ? 'image/png' :
                        'application/octet-stream';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to serve media' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { filename: string } }
) {
    try {
        const filename = params.filename;
        if (!filename) {
            return NextResponse.json({ error: 'Filename required' }, { status: 400 });
        }

        const metadata = await loadMetadata();
        const itemMetadata = metadata[filename];

        if (IS_VERCEL) {
            let allBlobs: any[] = [];
            let cursor: string | undefined = undefined;

            do {
                const result: { blobs: any[]; cursor?: string } = await list({ limit: 1000, cursor });
                allBlobs = allBlobs.concat(result.blobs);
                cursor = result.cursor;
            } while (cursor);

            const decodedFilename = decodeURIComponent(filename);
            const blob = allBlobs.find((b: any) => {
                const blobFilename = b.pathname.split('/').pop() || b.pathname;
                return blobFilename === decodedFilename || blobFilename === filename;
            });

            if (blob) {
                await del(blob.url);
            }
        } else {
            const filePath = path.join(UPLOAD_DIR, filename);
            if (existsSync(filePath)) {
                await unlink(filePath);
            }
        }

        // Cleanup metadata
        if (metadata[filename]) {
            delete metadata[filename];
            await saveMetadata(metadata);
        }

        return NextResponse.json({ success: true, message: 'Media deleted successfully' });
    } catch (error) {
        console.error('Error deleting media:', error);
        return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
    }
}
