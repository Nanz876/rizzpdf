from flask import Flask, request, send_file, jsonify
from pdf2docx import Converter
import tempfile, os, io, zipfile

app = Flask(__name__)


def fix_image_wrap(docx_bytes):
    """Convert anchored floating images (wrapNone) to wrapTopAndBottom so they don't overlap text."""
    in_buf = io.BytesIO(docx_bytes)
    out_buf = io.BytesIO()
    with zipfile.ZipFile(in_buf, "r") as zin, zipfile.ZipFile(out_buf, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "word/document.xml":
                xml = data.decode("utf-8")
                xml = xml.replace("<wp:wrapNone/>", "<wp:wrapTopAndBottom/>")
                data = xml.encode("utf-8")
            zout.writestr(item, data)
    return out_buf.getvalue()


@app.route("/api/pdf-to-word", methods=["POST"])
def convert():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]

    if not f.filename.lower().endswith(".pdf"):
        return jsonify({"error": "File must be a PDF"}), 400

    pdf_fd, pdf_path = tempfile.mkstemp(suffix=".pdf")
    docx_path = pdf_path[:-4] + ".docx"

    try:
        os.close(pdf_fd)
        f.save(pdf_path)

        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()

        # Read into memory before cleanup so temp files are deleted immediately
        with open(docx_path, "rb") as fh:
            docx_bytes = fh.read()

        # Fix floating images: wrapNone causes images to overlap text.
        # Change to wrapTopAndBottom so content flows below images.
        docx_bytes = fix_image_wrap(docx_bytes)

        out_name = os.path.splitext(f.filename)[0] + ".docx"

        return send_file(
            io.BytesIO(docx_bytes),
            as_attachment=True,
            download_name=out_name,
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        for path in [pdf_path, docx_path]:
            try:
                if os.path.exists(path):
                    os.unlink(path)
            except Exception:
                pass
