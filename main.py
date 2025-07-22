import os
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
#from googletrans import Translator
from gtts import gTTS
import uuid
import re
from indic_transliteration.sanscript import transliterate

# --- CrewAI & LangChain Imports ---
from langchain_openai import ChatOpenAI
from langchain.agents import create_openai_tools_agent, AgentExecutor
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.memory import ConversationBufferMemory

from dotenv import load_dotenv
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# Serve static files for TTS audio
if not os.path.exists('tts_audio'):
    os.makedirs('tts_audio')
from fastapi.staticfiles import StaticFiles
app.mount('/tts_audio', StaticFiles(directory='tts_audio'), name='tts_audio')

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Placeholder for user session storage (in-memory for now)
sessions = {}

class LoginRequest(BaseModel):
    phone_number: str
    language: str = 'en'

class ChatRequest(BaseModel):
    phone_number: str
    message: str
    language: str = 'en'

class TTSRequest(BaseModel):
    text: str
    language: str = 'en'

# --- LangChain + CrewAI Setup ---
llm = ChatOpenAI(model="gpt-4o", openai_api_key=OPENAI_API_KEY)
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are Cabwise, an AI cab booking assistant. Help users book cabs, answer questions about rides, payment, and support. Be concise, friendly, and only use English."),
    MessagesPlaceholder("history"),
    ("human", "{input}"),
    ("ai", "{agent_scratchpad}")
])
memory = ConversationBufferMemory(memory_key="history", return_messages=True)
agent = create_openai_tools_agent(llm, tools=[], prompt=prompt)
agent_executor = AgentExecutor(agent=agent, tools=[], memory=memory, verbose=False)

@app.post('/login')
def login(data: LoginRequest):
    sessions[data.phone_number] = {"language": "en"}
    return {"success": True}

@app.post('/chat')
def chat(data: ChatRequest):
    user_input = data.message
    response = agent_executor.invoke({"input": user_input})
    return {"response": response["output"]}

@app.post('/tts')
def tts(data: TTSRequest):
    text = data.text
    lang = 'en'
    filename = f"tts_audio/{uuid.uuid4().hex}.mp3"
    os.makedirs("tts_audio", exist_ok=True)
    tts = gTTS(text=text, lang=lang)
    tts.save(filename)
    return {"audio_url": f"/tts_audio/{os.path.basename(filename)}"}

@app.get("/tts_audio/{filename}")
def get_tts_audio(filename: str):
    return FileResponse(f"tts_audio/{filename}") 