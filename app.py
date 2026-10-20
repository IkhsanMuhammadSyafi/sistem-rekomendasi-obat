from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
import sqlite3
import os

app = Flask(__name__)
CORS(app)

#================= ROUTES =================
# Home Page

@app.route("/")
def home():
    return render_template("Apps.html")


# Get Obat Berdasarkan Golongan
@app.route("/get_obat", methods=["POST"])
def get_obat():
    data = request.json
    golongan = data["golongan"]
    tipe = data["tipe"]

    try:
        if tipe == "dm":
            conn = sqlite3.connect("obat_dm.db")
            cursor = conn.cursor()

            cursor.execute("""
                SELECT nama_obat 
                FROM obat_dm 
                WHERE golongan_obat = ?
            """, (golongan,))

        elif tipe == "bp":
            conn = sqlite3.connect("obat_bp.db")
            cursor = conn.cursor()

            cursor.execute("""
                SELECT nama_obat 
                FROM Obat_BP 
                WHERE golongan_obat = ?
            """, (golongan,))

        else:
            return jsonify({"error": "Tipe tidak valid"}), 400

        rows = cursor.fetchall()
        conn.close()

        obat_list = [row[0] for row in rows]

        return jsonify({"obat": obat_list})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Cek Interaksi Obat
@app.route("/check_interaksi", methods=["POST"])
def check_interaksi():
    data = request.json
    obat_list = data["obat"]

    conn = sqlite3.connect("interaksi.db")
    cursor = conn.cursor()

    interaksi_found = []

    for i in range(len(obat_list)):
        for j in range(i + 1, len(obat_list)):

            cursor.execute("""
                SELECT kategory, mekanisme
                FROM interaksi_golongan
                WHERE (LOWER(obat_1) = LOWER(?) AND LOWER(obat_2) = LOWER(?))
                OR (LOWER(obat_1) = LOWER(?) AND LOWER(obat_2) = LOWER(?))
            """, (obat_list[i], obat_list[j],
                  obat_list[j], obat_list[i]))

            result = cursor.fetchone()

            if result:
                interaksi_found.append({
                    "kombinasi": f"{obat_list[i]} x {obat_list[j]}",
                    "kategory": result[0],
                    "mekanisme": result[1]
                })

    conn.close()

    return jsonify({"interaksi": interaksi_found})


# Load Models
diabetes_model = pickle.load(open("diabetes_model.sav", "rb"))
dm_model = pickle.load(open("dm_revised_model.pkl", "rb"))
bp_model = pickle.load(open("bp_revised_model.pkl", "rb"))


# ================= LABEL MAPPING =================
dm_mapping = {
    0: "Biguanide",
    1: "Biguanide + Sodium-glucose Transporter 2 Inhibitors",
    2: "Biguanide + Sodium-glucose Transporter 2 Inhibitors + Dipeptidyl Peptidase 4 Inhibitors",
    3: "Biguanide + Sulfonylurea",
    4: "Biguanide + Sulfonylurea + Alpha-glucosidase Inhibitors",
    5: "Pertahankan Gaya Hidup Sehat"
}

bp_mapping = {
    0: "ACE inhibitor + Antagonis kalsium + Diuretik Thiazide",
    1: "Angiotensin receptor blocker + Antagonis kalsium",
    2: "Intervensi Gaya Hidup",
    3: "Pertahankan Gaya Hidup Sehat"
}


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        print("Data diterima:", data)

        # ================= DIAGNOSIS =================
        diabetes_features = np.array([[ 
            data["glucose"],
            data["blood_pressure"],
            data["bmi"],
            data["dpf"],
            data["age"],
            data["hba1c"]
        ]])

        print("Diabetes features:", diabetes_features)

        diagnosis_pred = diabetes_model.predict(diabetes_features)[0]
        diagnosis = "POSITIF DIABETES" if diagnosis_pred == 1 else "NEGATIF"

        # ================= DM RECOMMENDATION =================
        dm_features = np.array([[ 
            data["bmi"],
            data["glucose"],
            data["hba1c"]
        ]])

        print("DM features:", dm_features)

        dm_pred = dm_model.predict(dm_features)[0]

        # ================= BP RECOMMENDATION =================
        bp_features = np.array([[ 
            data["systolic_bp"],
            data["diastolic_bp"],
            int(data["prev_med"]) if data["prev_med"] else 0
        ]])

        print("BP features:", bp_features)

        bp_pred = bp_model.predict(bp_features)[0]

        return jsonify({
            "diagnosis": diagnosis,
            "rekomendasi_dm": dm_mapping.get(dm_pred, "Tidak Diketahui"),
            "rekomendasi_bp": bp_mapping.get(bp_pred, "Tidak Diketahui")
        })

    except Exception as e:
        print("ERROR TERJADI:", str(e))
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    app.run(host="0.0.0.0", port=port, debug=False)
