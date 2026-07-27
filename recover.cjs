const fs = require('fs');
const log = fs.readFileSync('C:/Users/samue/.gemini/antigravity/brain/5fb02193-1d15-4b91-9675-5c38fc7a0646/.system_generated/logs/overview.txt', 'utf8');

const regex = /File Path: \ile:\/\/\/c:\/Users\/samue\/maonaagua-155\/(.*?)\.*?<line_number>: <original_line>\. Please note that any changes targeting the original code should remove the line number, colon, and leading space\.\\n([\s\S]*?)(?:The above content shows|The above content does NOT)/g;

let match;
while ((match = regex.exec(log)) !== null) {
    const filePath = match[1];
    const rawContent = match[2];
    const cleanLines = rawContent.split('\\n').map(line => {
        const m = line.match(/^\d+:\s(.*)/);
        return m ? m[1] : '';
    }).join('\\n');
    console.log('Found:', filePath);
    // don't overwrite App.jsx if it is already right or wait
    fs.mkdirSync(filePath.split('/').slice(0,-1).join('/'), {recursive: true});
    fs.writeFileSync(filePath, cleanLines);
}
