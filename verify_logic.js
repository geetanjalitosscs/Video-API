const path = require('path');

// Ported logic from Video_API/app/api/videos/[filename]/route.ts
function findMatchingBlob(allBlobs, filename, decodedFilename) {
    const normalizedRequest = decodedFilename.toLowerCase();

    // Strategy 1: Exact match
    let blob = allBlobs.find((b) => {
        const blobFilename = b.pathname.split('/').pop() || b.pathname;
        return blobFilename === decodedFilename || blobFilename === filename;
    });

    // Strategy 2: Case-insensitive match
    if (!blob) {
        blob = allBlobs.find((b) => {
            const blobFilename = b.pathname.split('/').pop() || b.pathname;
            return blobFilename.toLowerCase() === normalizedRequest;
        });
    }

    // Strategy 3: Base name match (ignoring Vercel suffix)
    if (!blob) {
        const ext = path.extname(decodedFilename).toLowerCase();
        const baseName = path.basename(decodedFilename, ext).toLowerCase();

        blob = allBlobs.find((b) => {
            const bPath = b.pathname.split('/').pop() || '';
            const bExt = path.extname(bPath).toLowerCase();
            if (bExt !== ext) return false;

            const bBase = path.basename(bPath, bExt);
            return bBase.toLowerCase().startsWith(baseName) ||
                baseName.startsWith(bBase.toLowerCase().split('-')[0]);
        });
    }
    return blob;
}

// Test Cases
const mockBlobs = [
    { pathname: 'uploads/full_face_of_makeup-WkGu3YCeBTxMX6HA.jpg', url: 'url1' },
    { pathname: 'useful_random_finds-a127a8ac32charstoken.png', url: 'url2' },
    { pathname: 'video_file.mp4', url: 'url3' }
];

const tests = [
    { name: 'Exact Match', input: 'video_file.mp4', expected: 'url3' },
    { name: 'Case Insensitive', input: 'VIDEO_FILE.MP4', expected: 'url3' },
    { name: 'Vercel Suffix (Hyphen)', input: 'full_face_of_makeup.jpg', expected: 'url1' },
    { name: 'Vercel Suffix (No Hyphen)', input: 'useful_random_finds.png', expected: 'url2' }
];

console.log('--- RUNNING FUZZY MATCHING LOGIC VERIFICATION ---');
let passed = 0;
tests.forEach(t => {
    const result = findMatchingBlob(mockBlobs, t.input, decodeURIComponent(t.input));
    const status = result && result.url === t.expected ? '✅ PASSED' : '❌ FAILED';
    if (status.includes('✅')) passed++;
    console.log(`${status} | Test: ${t.name.padEnd(25)} | Input: ${t.input.padEnd(25)} | Result: ${result ? result.pathname : 'NONE'}`);
});

console.log(`\nFinal Result: ${passed}/${tests.length} tests passed.`);
process.exit(passed === tests.length ? 0 : 1);
