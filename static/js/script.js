    const systolicInput = document.getElementById('systolic');
    const diastolicInput = document.getElementById('diastolic');
    const prevMedContainer = document.getElementById('prev-med-container');
    const prevMedSelect = document.getElementById('prev-med');
    const bpAlert = document.getElementById('bp-alert');
    const resultsView = document.getElementById('results-view');

    // ===============================
    // ALTERNATIF PER GOLONGAN HIPERTENSI
    // ===============================

    const bpAlternatifLogic = {
    "Angiotensin receptor blocker": "ACE inhibitor",
    "ACE inhibitor": "Angiotensin receptor blocker",
    "Antagonis kalsium": "Diuretik Thiazide"
};


    // ===============================
    // 1️⃣ BP CLASSIFICATION
    // ===============================
    function checkBP() {
        const sys = parseFloat(systolicInput.value) || 0;
        const dia = parseFloat(diastolicInput.value) || 0;

        const isHighBP = (sys >= 140 || dia >= 90);

        if (isHighBP) {
            prevMedContainer.classList.remove('hidden-field');
            prevMedContainer.classList.add('visible-field');
            bpAlert.classList.remove('hidden');
            prevMedSelect.setAttribute('required', 'true');
        } else {
            prevMedContainer.classList.remove('visible-field');
            prevMedContainer.classList.add('hidden-field');
            bpAlert.classList.add('hidden');
            prevMedSelect.removeAttribute('required');
            prevMedSelect.value = "";
        }
    }

    systolicInput.addEventListener('input', checkBP);
    diastolicInput.addEventListener('input', checkBP);

    // ===============================
    // 2️⃣ FORM SUBMIT
    // ===============================
    document.getElementById('expert-form').addEventListener('submit', async function(e) {
        e.preventDefault();

        const formData = {
            glucose: parseFloat(document.getElementById('glucose').value),
            blood_pressure: parseFloat(document.getElementById('diastolic').value),
            bmi: parseFloat(document.getElementById('bmi').value),
            dpf: parseFloat(document.getElementById('dpf').value),
            age: parseInt(document.getElementById('age').value),
            hba1c: parseFloat(document.getElementById('hba1c').value),

            systolic_bp: parseFloat(document.getElementById('systolic').value),
            diastolic_bp: parseFloat(document.getElementById('diastolic').value),

            prev_med: document.getElementById('prev-med').value || 2
        };

        console.log("Data dikirim:", formData);

        try {
            const response = await fetch("/predict", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                alert("Server Error: " + result.error);
                console.error(result.error);
                return;
            }

            displayResults(result);

            // 🔽 TAMBAHKAN INI
            await loadObat(result.rekomendasi_dm, "dm");
            await loadObat(result.rekomendasi_bp, "bp");
            

            document.getElementById("obat-section").classList.remove("hidden");

        } catch (error) {
            alert("Gagal menghubungi server model.");
            console.error(error);
        }

    });

    // ===============================
    // 3️⃣ DISPLAY RESULT (NO PAGE SWITCH)
    // ===============================
    function displayResults(result) {
        const diagnosisRes = document.getElementById('res-diagnosis');
        const dmMedRes = document.getElementById('res-dm-med');
        const bpMedRes = document.getElementById('res-bp-med');

        diagnosisRes.textContent = result.diagnosis;
        diagnosisRes.className = result.diagnosis === "POSITIF DIABETES"
            ? "text-3xl font-extrabold text-red-600 mt-2"
            : "text-3xl font-extrabold text-green-600 mt-2";

        dmMedRes.textContent = result.rekomendasi_dm;
        bpMedRes.textContent = result.rekomendasi_bp;

        resultsView.classList.remove('hidden');

        resultsView.scrollIntoView({ behavior: "smooth" });

        document.getElementById("lifestyle-section")
            .classList.remove("hidden");

    }

    // ===============================
    // 5️⃣ LOAD OBAT BERDASARKAN GOLONGAN (SUPPORT KOMBINASI)
    // ===============================
    async function loadObat(golonganString, tipe) {

        const container = document.getElementById(`${tipe}-obat-list`);
        container.innerHTML = "";

        // 🔥 Split berdasarkan "+"
        const golonganList = golonganString.split(" + ");

        for (let golongan of golonganList) {

            golongan = golongan.trim();

            const response = await fetch("/get_obat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    golongan: golongan,
                    tipe: tipe
                })
            });

            const result = await response.json();

            container.innerHTML += `
                <h4 class="font-bold mt-4 mb-2 text-sm text-gray-700">
                    ${golongan}
                </h4>
            `;

            result.obat.forEach(obat => {
                container.innerHTML += `
                    <label class="block mb-1">
                        <input type="checkbox" class="obat-checkbox" value="${obat}">
                        ${obat}
                    </label>
                `;
            });
        }
    }

    
    // ===============================
    // 6️⃣ AUTO CHECK INTERACTION
    // ===============================
    document.addEventListener("change", async function (e) {

        if (!e.target.classList.contains("obat-checkbox")) return;

        const selected = Array.from(
            document.querySelectorAll(".obat-checkbox:checked")
        ).map(cb => cb.value);

        if (selected.length < 2) {
            document.getElementById("interaksi-result").innerHTML = "";
            return;
        }

        const response = await fetch("/check_interaksi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ obat: selected })
        });

        const result = await response.json();

        displayInteraction(result);
    });



    // ===============================
    // 7️⃣ CEK INTERAKSI
    // ===============================
    async function checkInteraksi() {

        const selected = [...document.querySelectorAll(".obat-checkbox:checked")]
            .map(cb => cb.value);

        if (selected.length < 2) {
            alert("Minimal pilih 2 obat untuk cek interaksi.");
            return;
        }

        const response = await fetch("/check_interaksi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ obat: selected })
        });

        const result = await response.json();

        tampilkanInteraksi(result.interaksi);
    }

    // ===============================
    // 8️⃣ TAMPILKAN INTERAKSI
    // ===============================
    function tampilkanInteraksi(interaksiList) {

        const container = document.getElementById("interaksi-result");
        container.innerHTML = "";

        const selected = Array.from(
            document.querySelectorAll(".obat-checkbox:checked")
        ).map(cb => cb.value);

        if (selected.length < 2) return;

        let kombinasiSemua = [];
        for (let i = 0; i < selected.length; i++) {
            for (let j = i + 1; j < selected.length; j++) {
                kombinasiSemua.push(`${selected[i]} x ${selected[j]}`);
            }
        }

        let kombinasiAdaInteraksi = interaksiList.map(item => item.kombinasi);

        let kombinasiAman = kombinasiSemua.filter(
            komb => !kombinasiAdaInteraksi.includes(komb)
        );

        // =========================
        // ⚠ INTERAKSI ADA
        // =========================
        if (interaksiList.length > 0) {

            container.innerHTML += `
                <h4 class="text-lg font-bold text-red-700 mb-3">
                    ⚠ Interaksi Ditemukan
                </h4>
            `;

            interaksiList.forEach(item => {
                container.innerHTML += `
                    <div class="bg-red-50 border border-red-300 p-4 rounded mb-4 shadow-sm">
                        <div class="font-semibold text-red-700 text-base">
                            ${item.kombinasi}
                        </div>
                        <div class="text-sm mt-1">
                            <strong>Kategori:</strong> ${item.kategory}
                        </div>
                        <div class="text-sm mt-1">
                            <strong>Mekanisme:</strong><br>
                            ${item.mekanisme}
                        </div>
                    </div>
                `;
            });
        }

        // =========================
        // ✅ KOMBINASI AMAN (DIRINGKAS)
        // =========================
        if (kombinasiAman.length > 0) {

            container.innerHTML += `
                <h4 class="text-lg font-bold text-green-700 mt-6 mb-3">
                    ✅ Kombinasi Tanpa Interaksi Signifikan
                </h4>
                <div class="bg-green-50 border border-green-300 p-4 rounded shadow-sm">
                    <ul class="list-disc list-inside text-sm space-y-1">
                        ${kombinasiAman.map(k => `<li>${k}</li>`).join("")}
                    </ul>
                </div>
            `;
        }

        // =========================
        // 🧠 CATATAN
        // =========================
        container.innerHTML += `
            <div class="mt-6 text-xs text-gray-500 italic">
                Evaluasi klinis dan monitoring pasien tetap diperlukan sesuai kondisi individual.
            </div>
        `;

        document.getElementById("interaksi-section")
            .classList.remove("hidden");

        document.getElementById("interaksi-section")
            .scrollIntoView({ behavior: "smooth" });
    }

    // ===============================
    // 6️⃣ BUTTON CEK INTERAKSI
    // ===============================
    document.getElementById("check-interaksi-btn")
        .addEventListener("click", checkInteraksi);


    // ===============================
    // 4️⃣ RESET FUNCTION
    // ===============================
    document.getElementById("reset-btn").addEventListener("click", function (e) {
        e.preventDefault();
        doReset();
    });

    function doReset() {

        // Reset semua input dalam form
        document.getElementById("expert-form").reset();

        // Sembunyikan hasil
        const resultsView = document.getElementById("results-view");
        resultsView.classList.add("hidden");

        // Reset teks hasil ke default
        document.getElementById("res-diagnosis").textContent = "--";
        document.getElementById("res-dm-med").textContent = "--";
        document.getElementById("res-bp-med").textContent = "--";

        // Sembunyikan obat & interaksi
        document.getElementById("obat-section").classList.add("hidden");
        document.getElementById("interaksi-section").classList.add("hidden");

        document.getElementById("dm-obat-list").innerHTML = "";
        document.getElementById("bp-obat-list").innerHTML = "";
        document.getElementById("interaksi-result").innerHTML = "";

        // Sembunyikan kembali prev_med container & alert
        const prevMedContainer = document.getElementById("prev-med-container");
        const bpAlert = document.getElementById("bp-alert");

        prevMedContainer.classList.remove("visible-field");
        prevMedContainer.classList.add("hidden-field");

        bpAlert.classList.add("hidden");

        // Scroll ke atas biar balik ke form
        window.scrollTo({ top: 0, behavior: "smooth" });

        document.getElementById("lifestyle-section")
            .classList.add("hidden");

    }