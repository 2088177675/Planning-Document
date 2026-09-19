# -*- coding: utf-8 -*-
"""AI 文本生成服务：仅使用本地 AI 模型

本地：llama-server / Ollama OpenAI 兼容接口
     http://127.0.0.1:11434/v1/chat/completions
模型：qwen2.5-1.5b（通过 ai_runtime/start_ai.bat 启动）
"""
import json
import time
import requests

OLLAMA_URL = "http://127.0.0.1:11434/v1/chat/completions"
LOCAL_MODEL = "qwen2.5:1.5b"
LOCAL_TIMEOUT = 300  # 本地模型生成可能较慢，给足超时


def _post_openai(url, payload, timeout, headers=None):
    start = time.time()
    try:
        resp = requests.post(url, json=payload, timeout=timeout, headers=headers or {})
        cost = int((time.time() - start) * 1000)
        if resp.status_code != 200:
            return "", cost, "HTTP %s: %s" % (resp.status_code, resp.text[:300])
        data = resp.json()
        content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
        return content, cost, None
    except Exception as e:
        return "", int((time.time() - start) * 1000), "EXCEPTION: %s" % e


def _chat_local(messages, max_tokens, temperature):
    """调用本地 llama-server / Ollama，返回 (content, cost_ms, error)"""
    return _post_openai(
        OLLAMA_URL,
        {
            "model": LOCAL_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "options": {"num_ctx": 8192},
        },
        timeout=LOCAL_TIMEOUT,
    )


def chat(messages, temperature=0.7, max_tokens=2048):
    """通用对话接口，messages = [{"role": "...", "content": "..."}]
    返回 (content_str, cost_ms, error) 三元组。
    """
    return _chat_local(messages, max_tokens, temperature)


# ---------------- 自学习平台专用生成模板 ----------------

PROMPT_TEMPLATES = {
    # kind -> 提示词模板（含 {prompt}, {subject}, {difficulty}）
    "ai_video_script": (
        "你是一位资深的视频讲解文案策划师。请基于以下知识点，制作一个短学习视频（时长 3-6 分钟）的完整素材包：\n"
        "1) 视频讲解文案（口语化、节奏清晰，标注[画面]与[口播]分段）\n"
        "2) 字幕文本（按句拆行，方便直接叠加到画面）\n"
        "3) 分镜讲解脚本（镜号/画面描述/口播词/时长估计）\n"
        "4) 知识点总结（5 条以内要点）\n"
        "5) 配套随堂小题（3 道选择题，附答案与解析）\n"
        "学科：{subject}；难度：{difficulty}。\n"
        "知识点：{prompt}\n请用 Markdown 输出，结构清晰。"
    ),
    "ai_mindmap": (
        "你是知识体系梳理专家。请基于以下知识点，输出一份结构化学习讲义与层级思维导图。\n"
        "要求：\n"
        "- 第一部分：结构化学习文档（含 概念定义 / 原理剖析 / 案例讲解 / 易错点 / 总结 / 课后习题 5 道带答案）\n"
        "- 第二部分：使用 Mermaid 语法 mindmap 的思维导图代码块（```mermaid ... ```），层级清晰，至少 3 层\n"
        "学科：{subject}；难度：{difficulty}。\n"
        "知识点：{prompt}\n请用 Markdown 输出。"
    ),
    "ai_doc": (
        "你是学习讲义撰写专家。请基于以下知识点，撰写一份结构化学习讲义，"
        "包含：概念定义、原理剖析、案例讲解、易错点、总结、课后习题 5 道带答案。\n"
        "学科：{subject}；难度：{difficulty}。\n"
        "知识点：{prompt}\n请用 Markdown 输出。"
    ),
    "ai_summary": (
        "请将以下知识点提炼为不超过 300 字的高浓度知识总结，结构化分点呈现。\n"
        "知识点：{prompt}\n学科：{subject}；难度：{difficulty}。"
    ),
    "ai_quiz": (
        "请基于以下知识点出 5 道练习题（4 道选择题 + 1 道简答题），附标准答案与解析。\n"
        "知识点：{prompt}\n学科：{subject}；难度：{difficulty}。"
    ),
}

AUTO_KIND_RULE = (
    "你是一个知识点体量判断器。阅读用户输入的知识点描述，"
    "判断它属于哪种类型，只输出一个 JSON：{{\"kind\":\"small\" 或 \"system\"}}。"
    "规则：零散、简短、单一概念、可在 3-6 分钟讲完的 -> small；"
    "章节、模块、知识体系、多关联知识点 -> system。只输出 JSON，不要解释。\n"
    "知识点：{prompt}"
)

ASSIST_SYSTEM_PROMPT = (
    "你是一名沉浸式 AI 实时助学助手。用户正在阅读一份学习资料，"
    "你必须严格依据当前资料上下文作答，不臆造无关内容。"
    "可执行：知识点答疑 / 难点解析 / 通俗化讲解 / 内容扩写 / 精简 / 重点提炼 / 智能出题 / 错题讲解 / 知识框架梳理。"
    "回答用 Markdown 输出，条理清晰。"
)


def generate_material(prompt, kind, subject, difficulty):
    """根据指定类型生成学习资料，返回 (content, cost_ms, error)"""
    tpl = PROMPT_TEMPLATES.get(kind)
    if not tpl:
        return "", 0, "未知生成类型：" + kind
    text = tpl.format(prompt=prompt, subject=subject or "通用", difficulty=difficulty or "常规学习")
    messages = [
        {"role": "system", "content": "你是面向高校师生的自学习平台 AI 内容生成助手。"},
        {"role": "user", "content": text},
    ]
    return chat(messages, max_tokens=3000)


def auto_decide_kind(prompt):
    """自动判断知识点体量，返回 small 或 system。失败默认 system"""
    text = AUTO_KIND_RULE.format(prompt=prompt)
    content, _, err = chat(
        [{"role": "user", "content": text}],
        temperature=0.1,
        max_tokens=64,
    )
    if err:
        return "system"
    try:
        obj = json.loads(content.strip().strip("`"))
        return "small" if obj.get("kind") == "small" else "system"
    except Exception:
        return "system"


def assist_chat(material, history, user_question):
    """基于当前资料上下文作答"""
    context = (material["content"] or "")[:6000]
    msgs = [{"role": "system", "content": ASSIST_SYSTEM_PROMPT + "\n\n【当前学习资料】" + (material["title"] or "")}]
    if context:
        msgs[0]["content"] += "\n" + context
    for h in history[-10:]:
        msgs.append({"role": h["role"], "content": h["content"]})
    msgs.append({"role": "user", "content": user_question})
    return chat(msgs, max_tokens=2000)
