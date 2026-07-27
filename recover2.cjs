
const fs = require("fs");
const log = fs.readFileSync("C:/Users/samue/.gemini/antigravity/brain/5fb02193-1d15-4b91-9675-5c38fc7a0646/.system_generated/logs/overview.txt", "utf8");

const lines = log.split("\n");
for(const line of lines) {
    if(!line.trim()) continue;
    try {
        const json = JSON.parse(line);
        if(json.type === "TOOL_RESPONSE" && json.content && json.content.includes("File Path: `file:///c:/Users/samue/maonaagua-155/")) {
            const content = json.content;
            const pathMatch = content.match(/File Path: `file:\/\/\/c:\/Users\/samue\/maonaagua-155\/(.*?)`/);
            if(!pathMatch) continue;
            const filePath = pathMatch[1];
            
            const startMarker = "The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.\n";
            const startIndex = content.indexOf(startMarker);
            if(startIndex === -1) continue;
            
            let codeBlock = content.substring(startIndex + startMarker.length);
            const endIndex = codeBlock.indexOf("\nThe above content");
            if(endIndex !== -1) {
                codeBlock = codeBlock.substring(0, endIndex);
            }
            
            const cleanLines = codeBlock.split("\n").map(l => {
                const m = l.match(/^\d+:\s?(.*)/);
                return m ? m[1] : "";
            }).join("\n");
            
            console.log("Restored:", filePath);
            fs.mkdirSync(filePath.split("/").slice(0,-1).join("/"), {recursive: true});
            fs.writeFileSync(filePath, cleanLines);
        }
    } catch(e) {}
}

