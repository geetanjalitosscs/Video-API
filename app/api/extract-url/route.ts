import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { put } from '@vercel/blob';

interface MediaMetadata {
  filename: string;
  mediaUrl?: string; // Original URL (ShopClues, WebScraper, or YouTube)
  youtubeUrl?: string; // Specifically for YouTube embeds
  title?: string;
  description?: string;
  type?: 'video' | 'audio' | 'youtube';
}

const METADATA_FILE = path.join(process.cwd(), 'public', 'uploads', 'metadata.json');
const METADATA_BLOB_NAME = 'metadata.json';
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const IS_VERCEL = process.env.VERCEL === '1';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadMetadata(): Promise<Record<string, MediaMetadata>> {
  try {
    if (IS_VERCEL) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return {};
      try {
        const { list } = await import('@vercel/blob');
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

async function downloadAndSaveImage(imageUrl: string, filenameBase: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
    
    const randomSuffix = randomBytes(4).toString('hex');
    const filename = `${filenameBase}_thumb_${randomSuffix}${ext}`;

    if (IS_VERCEL) {
      await put(filename, buffer, { access: 'public', contentType });
      return filename;
    } else {
      if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(buffer));
      return filename;
    }
  } catch (error) {
    console.error('Error saving thumbnail:', error);
    return null;
  }
}

async function extractYouTubeMetadata(url: string) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { productUrl } = await request.json();

    if (!productUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const isYouTube = productUrl.includes('youtube.com') || productUrl.includes('youtu.be');
    
    if (isYouTube) {
      const metadata = await extractYouTubeMetadata(productUrl);
      if (!metadata) {
        return NextResponse.json({ error: 'Failed to extract YouTube metadata' }, { status: 400 });
      }

      const sanitizedTitle = metadata.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 50);
      const thumbFilename = await downloadAndSaveImage(metadata.thumbnail_url, sanitizedTitle);

      const allMetadata = await loadMetadata();
      const entryId = thumbFilename || `youtube_${randomBytes(4).toString('hex')}`;
      
      allMetadata[entryId] = {
        filename: entryId,
        youtubeUrl: productUrl,
        title: metadata.title,
        description: `YouTube video by ${metadata.author_name}`,
        type: 'youtube'
      };

      await saveMetadata(allMetadata);

      return NextResponse.json({
        success: true,
        productName: metadata.title,
        productDescription: `YouTube video by ${metadata.author_name}`,
        imageUrl: metadata.thumbnail_url,
        productUrl: productUrl,
        type: 'youtube'
      });
    }

    // Generic extraction (ShopClues, etc.) could be added here, 
    // but focusing on YouTube as requested for now.
    return NextResponse.json({ error: 'Unsupported URL. Please provide a YouTube link.' }, { status: 400 });

  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
