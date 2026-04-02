from groq import Groq

from app.config import settings


def ask_groq(message: str, image_base64: str | None = None) -> str:
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is missing from environment.")

    client = Groq(api_key=settings.groq_api_key)
    content: list[dict] = []

    if image_base64:
        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_base64}",
                },
            }
        )

    content.append({"type": "text", "text": message})

    response = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[{"role": "user", "content": content}],
    )

    return response.choices[0].message.content or ""
