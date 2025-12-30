
import os
import asyncio
import traceback
import json
from dotenv import load_dotenv

# Load env
load_dotenv()

# Import Agent
try:
    from app.agent import blog_writer_agent
except ImportError as e:
    print(f"Error importing agent: {e}")
    exit(1)

async def test_agent():
    print("🧪 Testing Blog Writer Agent...")
    prompt = "Write a short blog post about the new iPhone 16."
    
    try:
        # Trying run_async with detailed error catching
        print("▶️ Calling run_async...")
        
        # Capture raw response if possible
        # Check if we can just get the result directly without loop if it's not a generator
        # But previous error said it IS a generator.
        
        async for chunk in blog_writer_agent.run_async(prompt):
            print(f"📦 Check Chunk Type: {type(chunk)}")
            print(f"📦 Chunk Content: {chunk}")
            
    except Exception:
        print("❌ Crashing...")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_agent())
