import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from pydantic import BaseModel
from langgraph.graph import StateGraph, END, START
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

logger = logging.getLogger("AgentForge.Debate")

class DebateState(BaseModel):
    session_id: str
    topic: str
    proposer_id: str
    reviewer_id: str
    proposer_prompt: str
    reviewer_prompt: str
    messages: List[Dict[str, str]]
    turn_count: int
    consensus_reached: bool
    backend_url: str
    secret: str

async def broadcast_message(state: DebateState, agent_id: str, content: str):
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{state.backend_url}/api/internal/debate/message",
                json={
                    "sessionId": state.session_id,
                    "agentId": agent_id,
                    "content": content
                },
                headers={"X-Internal-Secret": state.secret}
            )
    except Exception as e:
        logger.error(f"Failed to broadcast debate message: {e}")

async def proposer_node(state: DebateState):
    if state.consensus_reached or state.turn_count >= 3:
        return state

    llm = ChatGoogleGenerativeAI(model="gemini-3.8-flash", temperature=0.7)
    
    chat_history = [SystemMessage(content=state.proposer_prompt)]
    chat_history.append(HumanMessage(content=f"Topic: {state.topic}. Present your initial proposal or respond to the reviewer's critique."))
    
    for msg in state.messages:
        if msg["agent"] == state.proposer_id:
            chat_history.append(AIMessage(content=msg["content"]))
        else:
            chat_history.append(HumanMessage(content=f"Reviewer: {msg['content']}"))

    response = await llm.ainvoke(chat_history)
    content = response.content
    state.messages.append({"agent": state.proposer_id, "content": content})
    await broadcast_message(state, state.proposer_id, content)
    
    return state

async def reviewer_node(state: DebateState):
    if state.consensus_reached or state.turn_count >= 3:
        return state

    llm = ChatGoogleGenerativeAI(model="gemini-3.8-flash", temperature=0.7)
    
    sys_prompt = state.reviewer_prompt + "\n\nCRITICAL: If you agree with the proposer and no further changes are needed, you MUST include the exact string 'CONSENSUS_REACHED' in your response."
    chat_history = [SystemMessage(content=sys_prompt)]
    chat_history.append(HumanMessage(content=f"Topic: {state.topic}. Critique the proposer's approach."))
    
    for msg in state.messages:
        if msg["agent"] == state.reviewer_id:
            chat_history.append(AIMessage(content=msg["content"]))
        else:
            chat_history.append(HumanMessage(content=f"Proposer: {msg['content']}"))

    response = await llm.ainvoke(chat_history)
    content = response.content
    state.messages.append({"agent": state.reviewer_id, "content": content})
    await broadcast_message(state, state.reviewer_id, content)
    
    if "CONSENSUS_REACHED" in content:
        state.consensus_reached = True

    state.turn_count += 1
    return state

def should_continue(state: DebateState):
    if state.consensus_reached or state.turn_count >= 3:
        return END
    return "proposer"

def build_debate_graph():
    builder = StateGraph(DebateState)
    builder.add_node("proposer", proposer_node)
    builder.add_node("reviewer", reviewer_node)
    
    builder.add_edge(START, "proposer")
    builder.add_edge("proposer", "reviewer")
    builder.add_conditional_edges("reviewer", should_continue)
    
    return builder.compile()
