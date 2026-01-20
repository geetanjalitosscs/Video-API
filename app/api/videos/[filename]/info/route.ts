import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { existsSync, statSync } from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const IS_VERCEL = process.env.VERCEL === '1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
    request: NextRequest,
    { params }: { params: { filename: string } }
) {
    try {
        const filename = params.filename;

        if (IS_VERCEL) {
            const { list } = await import('@vercel/blob');
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

            if (!blob) {
                return NextResponse.json({ error: 'File not found' }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                filename: filename,
                url: blob.url,
                apiUrl: `/api/videos/${filename}`,
                size: (blob as any).size || null,
                uploadedAt: (blob as any).uploadedAt || null,
            });
        }

        const filePath = path.join(UPLOAD_DIR, filename);
        if (!existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const stats = statSync(filePath);
        return NextResponse.json({
            success: true,
            filename: filename,
            url: `/api/videos/${filename}`,
            apiUrl: `/api/videos/${filename}`,
            size: stats.size,
            uploadedAt: stats.mtime.toISOString(),
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to get info' }, { status: 500 });
    }
}
