from flask import Flask, request, send_file, jsonify
from pdf2docx import Converter
import tempfile, os, io

app = Flask(__name__)

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
