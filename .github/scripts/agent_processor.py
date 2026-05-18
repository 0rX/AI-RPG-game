import os
import json
import requests

def main():
    api_key = os.getenv("GEMINI_API_KEY")
    issue_title = os.getenv("ISSUE_TITLE")
    issue_body = os.getenv("ISSUE_BODY")
    
    if not api_key:
        print("❌ Error: GEMINI_API_KEY secret is missing.")
        return

    # Core context files for your AI RPG game engine
    files_to_context = [
        "src/lib/game-types.ts",
        "src/lib/game-engine.ts",
        "src/lib/ai-director.ts",
        "prisma/schema.prisma"
    ]
    
    context = ""
    for fpath in files_to_context:
        if os.path.exists(fpath):
            context += f"\n\n--- FILE: {fpath} ---\n"
            with open(fpath, "r", encoding="utf-8") as f:
                context += f.read()

    prompt = f"""
    You are an automated game engineer agent modifying the ai-rpg-game engine codebase.
    The user wants to implement or fix this feature: {issue_title}
    Instruction Details: {issue_body}
    
    Current engine architecture context:
    {context}
    
    Output your modifications by replacing or providing the full content of the file(s) you are changing. You must wrap each file completely between the strict tags like this:
    
    START_FILE: src/lib/game-engine.ts
    // complete updated code here
    END_FILE
    
    Only modify relevant files or create new files if requested. Do not output conversational text outside of these tags.
    """

    # Hit the Google Gemini API endpoint
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {'Content-Type': 'application/json'}
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    print("📡 Sending code context and prompt to AI model...")
    response = requests.post(url, headers=headers, json=payload).json()
    
    try:
        ai_text = response['candidates'][0]['content']['parts'][0]['text']
    except (KeyError, IndexError):
        print("❌ Error parsing response from AI API. Full payload:")
        print(json.dumps(response, indent=2))
        return
    
    # Parse the output stream back into real project files
    lines = ai_text.split('\n')
    writing = False
    current_file = None
    file_lines = []
    
    for line in lines:
        if line.startswith("START_FILE:"):
            current_file = line.replace("START_FILE:", "").strip()
            writing = True
            file_lines = []
            print(f"🛠️ Preparing modifications for: {current_file}")
            continue
        elif line.strip() == "END_FILE":
            if current_file:
                os.makedirs(os.path.dirname(current_file), exist_ok=True)
                with open(current_file, "w", encoding="utf-8") as out:
                    out.write("\n".join(file_lines).strip())
                print(f"✅ Successfully rewrote: {current_file}")
            writing = False
            current_file = None
            continue
        
        if writing:
            file_lines.append(line)

if __name__ == "__main__":
    main()