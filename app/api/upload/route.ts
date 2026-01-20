import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { put } from '@vercel/blob';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska', 'video/avi', 'video/x-flv', 'video/mpeg',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-m4a', 'audio/aac', 'audio/ogg'
];
const ALLOWED_EXTENSIONS = [
    '.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi', '.flv', '.mpeg', '.mpg',
    '.mp3', '.wav', '.m4a', '.aac'
];
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const METADATA_FILE = path.join(process.cwd(), 'public', 'uploads', 'metadata.json');
const METADATA_BLOB_NAME = 'metadata.json';
const IS_VERCEL = process.env.VERCEL === '1';

interface MediaMetadata {
    filename: string;
    mediaUrl?: string;
    description?: string;
    title?: string;
    type?: 'video' | 'audio' | 'youtube';
    uploadedAt?: string;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sanitizeFilename(filename: string): string {
    return filename
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase();
}

function generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const sanitized = sanitizeFilename(baseName);
    const randomSuffix = randomBytes(8).toString('hex');
    return `${sanitized}_${randomSuffix}${ext}`;
}

async function loadMetadata(): Promise<Record<string, MediaMetadata> | null> {
    try {
        if (IS_VERCEL) {
            if (!process.env.BLOB_READ_WRITE_TOKEN) return {};
            try {
                const { list } = await import('@vercel/blob');
                const blobs = await list({ prefix: METADATA_BLOB_NAME, limit: 1 });
                if (blobs.blobs.length > 0) {
                    const response = await fetch(blobs.blobs[0].url, { cache: 'no-store' });
                    if (response.ok) return await response.json();
                    if (response.status === 404) return {};
                    return null;
                }
                return {};
            } catch (error) {
                console.error('Error loading metadata from blob:', error);
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

async function saveMetadata(metadata: Record<string, MediaMetadata>): Promise<void> {
    try {
        if (IS_VERCEL) {
            if (!process.env.BLOB_READ_WRITE_TOKEN) return;
            const metadataJson = JSON.stringify(metadata, null, 2);
            await put(METADATA_BLOB_NAME, metadataJson, {
                access: 'public',
                contentType: 'application/json',
                addRandomSuffix: false,
            });
        } else {
            const dir = path.dirname(METADATA_FILE);
            if (!existsSync(dir)) await mkdir(dir, { recursive: true });
            await writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
        }
    } catch (error) {
        console.error('Error saving metadata:', error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('media') as File[];
        const productUrl = formData.get('productUrl') as string | null;

        if (files.length === 0) {
            return NextResponse.json({ error: 'No files provided' }, { status: 400 });
        }

        const uploadedFiles: string[] = [];
        const errors: string[] = [];
        const metadataResult = await loadMetadata();

        if (metadataResult === null) {
            return NextResponse.json({ error: 'Failed to access media registry. Please try again soon.' }, { status: 503 });
        }

        const metadata = metadataResult;

        for (const file of files) {
            if (!(file instanceof File)) {
                errors.push('Invalid file object');
                continue;
            }

            const fileType = file.type.toLowerCase();
            const fileExt = path.extname(file.name).toLowerCase();

            const isValidType = ALLOWED_TYPES.includes(fileType) ||
                ALLOWED_EXTENSIONS.includes(fileExt);

            if (!isValidType) {
                const errorMsg = `${file.name}: Invalid file type. Supported: Videos (MP4, WebM, etc.) and Audio (MP3, WAV, etc.)`;
                errors.push(errorMsg);
                continue;
            }

            if (file.size > MAX_FILE_SIZE) {
                errors.push(`${file.name}: File size exceeds 100MB limit.`);
                continue;
            }

            try {
                const bytes = await file.arrayBuffer();
                const uniqueFilename = generateUniqueFilename(file.name);
                let savedFilename = uniqueFilename;

                if (IS_VERCEL) {
                    if (!process.env.BLOB_READ_WRITE_TOKEN) {
                        errors.push(`${file.name}: Vercel Blob storage not configured.`);
                        continue;
                    }
                    const blob = await put(uniqueFilename, bytes, {
                        access: 'public',
                        contentType: file.type || 'application/octet-stream',
                    });
                    savedFilename = blob.pathname.split('/').pop() || uniqueFilename;
                } else {
                    if (!existsSync(UPLOAD_DIR)) {
                        await mkdir(UPLOAD_DIR, { recursive: true });
                    }
                    const buffer = Buffer.from(bytes);
                    const filePath = path.join(UPLOAD_DIR, uniqueFilename);
                    await writeFile(filePath, buffer);
                }

                uploadedFiles.push(savedFilename);

                // Save metadata
                const ext = path.extname(savedFilename).toLowerCase();
                const baseName = path.basename(savedFilename, ext);
                const isAudio = ['.mp3', '.wav', '.m4a', '.aac'].includes(ext);

                metadata[savedFilename] = {
                    filename: savedFilename,
                    mediaUrl: productUrl || undefined,
                    title: baseName.replace(/_[a-zA-Z0-9]{16}$/, '').replace(/_/g, ' ').trim() || 'Untitled',
                    type: isAudio ? 'audio' : 'video',
                    uploadedAt: new Date().toISOString()
                };

            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : String(error);
                errors.push(`${file.name}: Failed to save - ${errorDetails}`);
            }
        }

        await saveMetadata(metadata);

        if (uploadedFiles.length === 0) {
            return NextResponse.json({ error: 'No files uploaded', errors }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            uploaded: uploadedFiles.length,
            files: uploadedFiles,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
