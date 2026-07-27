
const fs = require("fs");
const log = fs.readFileSync("C:/Users/samue/.gemini/antigravity/brain/5fb02193-1d15-4b91-9675-5c38fc7a0646/.system_generated/logs/overview.txt", "utf8");

const lines = log.split("\n");
let count = 0;
for(const line of lines) {
    if(!line.trim()) continue;
    try {
        const json = JSON.parse(line);
        if(json.type === "TOOL_RESPONSE" && json.content) {
            const pathMatch = json.content.match(/File Path: `file:\/\/\/(.*?)`/);
            if(pathMatch) {
                console.log("Found:", pathMatch[1]);
                count++;
            }
        }
    } catch(e) {}
}
console.log("Total found:", count);

