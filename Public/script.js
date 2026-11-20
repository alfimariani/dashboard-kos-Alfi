
const API = "/api";

let charts = {};

function formatRupiah(angka) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(angka);
}

function formatAngka(angka, digit = 1) {
    return Number(angka).toFixed(digit).replace(".", ",");
}

// Mengambil data statistik dari API
async function loadDashboard() {
    try {
        const response = await fetch(`${API}/stats`);

        if (!response.ok) {
            throw new Error("Gagal mengambil data dashboard.");
        }

        const data = await response.json();

        // Mengisi kartu statistik
        document.getElementById("totalData").textContent =
            data.total_data;

        document.getElementById("rataHarga").textContent =
            formatRupiah(data.rata_harga);

        document.getElementById("rataJarak").textContent =
            formatAngka(data.rata_jarak) + " km";

        document.getElementById("rataRating").textContent =
            formatAngka(data.rata_rating);

        // Menampilkan grafik
        tampilkanGrafik(data);

        // Menampilkan tabel dataset
        tampilkanTabel(data.dataset);

        // Meminta penjelasan AI
        jelaskanSemuaGrafik(data);

    } catch (error) {
        console.error(error);
        alert("Data dashboard gagal dimuat. Periksa koneksi API.");
    }
}

// Pengaturan grafik
function buatGrafik(id, jenis, label, labels, values, warna) {
    const canvas = document.getElementById(id);

    if (!canvas) return;

    if (charts[id]) {
        charts[id].destroy();
    }

    charts[id] = new Chart(canvas, {
        type: jenis,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: warna,
                borderColor: "#c66b96",
                borderWidth: 2,
                borderRadius: 6,
                tension: 0.3,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: jenis !== "bar"
                }
            },
            scales: jenis === "doughnut" ? {} : {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Menampilkan semua grafik
function tampilkanGrafik(data) {

    // Grafik distribusi harga
    buatGrafik(
        "chartHarga",
        "bar",
        "Harga Kos",
        data.harga.map((_, i) => "Data " + (i + 1)),
        data.harga.map(h => h * 1000),
        "#d98caf"
    );

    // Grafik jarak terhadap harga
    buatGrafik(
        "chartJarak",
        "scatter",
        "Jarak dan Harga",
        [],
        data.jarak.map((jarak, i) => ({
            x: jarak,
            y: data.harga[i] * 1000
        })),
        "#91a9dc"
    );

    // Grafik rating terhadap harga
    buatGrafik(
        "chartRating",
        "scatter",
        "Rating dan Harga",
        [],
        data.rating.map((rating, i) => ({
            x: rating,
            y: data.harga[i] * 1000
        })),
        "#91c9b5"
    );

    // Grafik rata-rata harga berdasarkan AC
    const ac = data.rata_ac;

    buatGrafik(
        "chartAC",
        "bar",
        "Rata-rata Harga",
        Object.keys(ac).map(k => k === "1" ? "Dengan AC" : "Tanpa AC"),
        Object.values(ac),
        "#b5a0d9"
    );
}

// Menampilkan tabel dataset
function tampilkanTabel(dataset) {
    const head = document.getElementById("tableHead");
    const body = document.getElementById("tableBody");

    if (!dataset || dataset.length === 0) return;

    const kolom = Object.keys(dataset[0]);

    head.innerHTML = "";

    const barisHeader = document.createElement("tr");

    kolom.forEach(nama => {
        const th = document.createElement("th");
        th.textContent = nama;
        barisHeader.appendChild(th);
    });

    head.appendChild(barisHeader);
    body.innerHTML = "";

    dataset.forEach(item => {
        const tr = document.createElement("tr");

        kolom.forEach(nama => {
            const td = document.createElement("td");
            td.textContent = item[nama];
            tr.appendChild(td);
        });

        body.appendChild(tr);
    });
}

// Meminta penjelasan grafik dari AI
async function jelaskanGrafik(id, nama, informasi) {
    const elemen = document.getElementById(id);

    if (!elemen) return;

    elemen.textContent = "AI sedang menganalisis grafik...";

    try {
        const response = await fetch(`${API}/explain`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nama_grafik: nama,
                informasi: informasi
            })
        });

        const hasil = await response.json();

        if (!response.ok) {
            throw new Error(hasil.detail || "Gagal mendapatkan penjelasan AI.");
        }

        elemen.textContent = hasil.penjelasan;

    } catch (error) {
        elemen.textContent = "Penjelasan AI belum dapat ditampilkan.";
        console.error(error);
    }
}

// Menyiapkan informasi untuk AI
function jelaskanSemuaGrafik(data) {

    jelaskanGrafik(
        "aiHarga",
        "Distribusi Harga Kos",
        `Data harga kos: ${data.harga.join(", ")}`
    );

    jelaskanGrafik(
        "aiJarak",
        "Hubungan Jarak dan Harga",
        `Jarak: ${data.jarak.join(", ")}. Harga: ${data.harga.join(", ")}`
    );

    jelaskanGrafik(
        "aiRating",
        "Hubungan Rating dan Harga",
        `Rating: ${data.rating.join(", ")}. Harga: ${data.harga.join(", ")}`
    );

    jelaskanGrafik(
        "aiAC",
        "Perbandingan Harga Kos Berdasarkan AC",
        `Rata-rata harga berdasarkan AC: ${JSON.stringify(data.rata_ac)}`
    );
}

// Proses prediksi harga kos
document.getElementById("predictionForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const jarak = Number(document.getElementById("jarak").value);
    const rating = Number(document.getElementById("rating").value);
    const ac = Number(document.getElementById("ac").value);

    const hasilElement = document.getElementById("hasilPrediksi");
    const pesanElement = document.getElementById("pesanPrediksi");

    hasilElement.textContent = "Menghitung...";
    pesanElement.textContent = "";

    try {
        const response = await fetch(`${API}/predict`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                jarak_km: jarak,
                rating: rating,
                ac_num: ac
            })
        });

        const hasil = await response.json();

        if (!response.ok) {
            throw new Error(hasil.detail || "Prediksi gagal.");
        }

        hasilElement.textContent = formatRupiah(hasil.prediksi);
        pesanElement.textContent = hasil.pesan;

    } catch (error) {
        hasilElement.textContent = "Prediksi gagal";
        pesanElement.textContent = error.message;
    }
});

// Menjalankan dashboard saat halaman dibuka
loadDashboard();
