import base64
import io

import fitz
import pdfplumber

from app.groq_client import ask_groq

MAX_PDF_VISION_PAGES = 10
MAX_TEXT_CHARS = 120_000


def ask_groq_with_pdf(question: str, pdf_base64: str) -> str:
    pdf_bytes = _decode_pdf_base64(pdf_base64)

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        page_count = doc.page_count

    if page_count <= MAX_PDF_VISION_PAGES:
        return _ask_groq_with_pdf_pages(question, pdf_bytes, page_count)

    extracted_text = _extract_text_pdfplumber(pdf_bytes)
    prompt = (
        "You are analyzing a PDF document. Use the extracted text below to answer the user. "
        "If information is missing because of scanned/image-only content, say that clearly.\n\n"
        f"User question: {question or 'Summarize this PDF'}\n\n"
        f"Extracted PDF text:\n{extracted_text[:MAX_TEXT_CHARS]}"
    )
    return ask_groq(prompt)


def _ask_groq_with_pdf_pages(question: str, pdf_bytes: bytes, page_count: int) -> str:
    page_analyses: list[str] = []

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for idx, page in enumerate(doc, start=1):
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            image_base64 = base64.b64encode(pix.tobytes("jpeg")).decode("utf-8")

            page_prompt = (
                f"You are reading page {idx}/{page_count} of a PDF. "
                "Extract key text, tables, and important visual details relevant to the user question.\n"
                f"User question: {question or 'Summarize this PDF'}"
            )
            page_answer = ask_groq(page_prompt, image_base64)
            page_analyses.append(f"Page {idx}: {page_answer}")

    final_prompt = (
        "You are given per-page analyses from a PDF. Create one final, concise and accurate answer.\n"
        "If the question cannot be fully answered from the provided page analyses, say what is missing.\n\n"
        f"User question: {question or 'Summarize this PDF'}\n\n"
        f"Page analyses:\n{chr(10).join(page_analyses)}"
    )
    return ask_groq(final_prompt)


def _extract_text_pdfplumber(pdf_bytes: bytes) -> str:
    chunks: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            page_text = (page.extract_text() or "").strip()
            if page_text:
                chunks.append(f"[Page {idx}]\n{page_text}")

    if not chunks:
        return "No extractable text was found in this PDF."

    return "\n\n".join(chunks)


def _decode_pdf_base64(pdf_base64: str) -> bytes:
    try:
        return base64.b64decode(pdf_base64)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid PDF base64 payload") from exc
