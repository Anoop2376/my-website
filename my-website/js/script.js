const MILK_RATE = 65; // ₹65 per kg
const STORAGE_KEY = "evening_milk_delivery_v1";
const DEFAULT_MAX_CUSTOMERS = 35; // <-- Yahan add karein

const DEFAULT_MAX_STOCK = {
  2: 4,
  1.5: 6,
  1: 18,
  0.75: 1,
  0.5: 6,
};

const DEFAULT_CUSTOMERS = [
  {
    id: "c1",
    area: "Yadav Gaushala wali gali",
    name: "Ghar 1 (Yadav Gaushala ke paas)",
    phone: "",
    defaultPacket: 2,
  },
  {
    id: "c2",
    area: "Rekha Arya ke saamne wali gali",
    name: "Pehla Ghar (Ground Floor)",
    phone: "",
    defaultPacket: 1,
  },
  {
    id: "c3",
    area: "Rekha Arya ke saamne wali gali",
    name: "Pehla Ghar (2nd Floor / Doosra Maala)",
    phone: "",
    defaultPacket: 1.5,
  },
  {
    id: "c4",
    area: "Rekha Arya ke saamne wali gali",
    name: "Uske Saamne Wala Ghar",
    phone: "",
    defaultPacket: 1,
  },
  {
    id: "c5",
    area: "Rekha Arya ke saamne wali gali",
    name: "Usse Aage Wala Ghar",
    phone: "",
    defaultPacket: 1,
  },
  {
    id: "c6",
    area: "Yamuna Colony - Radha Krishna Gali",
    name: "Radha Krishna Gali Ghar 1",
    phone: "",
    defaultPacket: 0.5,
  },
];

function getTodayStr() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("Data parse error", e);
    }
  }
  return {
    maxCustomers: DEFAULT_MAX_CUSTOMERS,
    customers: [...DEFAULT_CUSTOMERS],
    dailyStock: {}, // { "2026-11-20": { "2": 4, "1.5": 6, "1": 18, "0.75": 1, "0.5": 6 } }
    deliveries: {}, // { "2026-11-20": { "c1": { status: "delivered"|"skip", milkKg: 2, itemName: "", itemPrice: 0 } } }
    payments: {}, // { "2026-11": { "c1": [ { amount: 500, mode: "UPI", date: "2026-11-20" } ] } }
  };
}

let state = loadState();
let selectedDate = getTodayStr();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getStockForDate(dateStr) {
  if (!state.dailyStock[dateStr]) {
    state.dailyStock[dateStr] = { ...DEFAULT_MAX_STOCK };
    saveState();
  }
  return state.dailyStock[dateStr];
}

// Packet breakdown helper for stock deduction
function getPacketsUsedForKg(kg) {
  const map = {
    2: { 2: 1 },
    1.5: { 1.5: 1 },
    1: { 1: 1 },
    0.75: { 0.75: 1 },
    0.5: { 0.5: 1 },
    2.5: { 1.5: 1, 1: 1 },
    3: { 2: 1, 1: 1 },
  };
  return map[kg] || {};
}

function calculateRemainingStock(dateStr) {
  const initial = getStockForDate(dateStr);
  const remaining = { ...initial };
  const dayDeliveries = state.deliveries[dateStr] || {};

  Object.values(dayDeliveries).forEach((entry) => {
    if (entry.status === "delivered" && entry.milkKg > 0) {
      const used = getPacketsUsedForKg(entry.milkKg);
      Object.entries(used).forEach(([size, qty]) => {
        if (remaining[size] !== undefined) {
          remaining[size] -= qty;
        }
      });
    }
  });

  return remaining;
}

function renderStockBar() {
  const rem = calculateRemainingStock(selectedDate);
  const sizes = ["2", "1.5", "1", "0.75", "0.5"];
  const stockGrid = document.getElementById("stockGrid");
  let totalPackets = 0;
  let totalKg = 0;

  stockGrid.innerHTML = sizes
    .map((sz) => {
      const count = rem[sz] ?? 0;
      totalPackets += count;
      totalKg += count * parseFloat(sz);
      return `
      <div class="stock-chip ${count <= 0 ? "low" : ""}">
        <span class="size">${sz} kg</span>
        <span class="count">${count}</span>
      </div>
    `;
    })
    .join("");

  document.getElementById("stockTotalSummary").textContent =
    `Bacha Stock: ${totalPackets} Packets (${totalKg.toFixed(2)} kg)`;
}

function renderRouteList() {
  const query = document
    .getElementById("searchCustomerInput")
    .value.toLowerCase();
  const dayDeliveries = state.deliveries[selectedDate] || {};
  const listEl = document.getElementById("routeList");

  let deliveredCount = 0;
  let totalMilkToday = 0;
  let totalAmountToday = 0;

  state.customers.forEach((c) => {
    const rec = dayDeliveries[c.id];
    if (rec && rec.status === "delivered") {
      deliveredCount++;
      totalMilkToday += rec.milkKg;
      totalAmountToday += rec.milkKg * MILK_RATE + (rec.itemPrice || 0);
    }
  });

  document.getElementById("dailySummaryStrip").textContent =
    `Aaj Delivered: ${deliveredCount}/${state.customers.length} Ghar | Total Dudh: ${totalMilkToday} kg | Total: ₹${totalAmountToday}`;

  const filtered = state.customers.filter(
    (c) =>
      c.area.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query),
  );

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="card">Koi customer nahi mila.</div>`;
    return;
  }

  listEl.innerHTML = filtered
    .map((cust, index) => {
      const rec = dayDeliveries[cust.id];
      let statusClass = "";
      let statusHtml = "";

      if (rec?.status === "delivered") {
        statusClass = "status-delivered";
        const milkAmt = rec.milkKg * MILK_RATE;
        const extraTxt =
          rec.itemPrice > 0 ? ` + ${rec.itemName} (₹${rec.itemPrice})` : "";
        statusHtml = `<div class="status-note">✅ Diya: ${rec.milkKg} kg (₹${milkAmt})${extraTxt}</div>`;
      } else if (rec?.status === "skip") {
        statusClass = "status-skip";
        statusHtml = `<div class="status-note">❌ Aaj Chutti / Nahi Liya</div>`;
      }

      return `
      <div class="card ${statusClass}">
        <div class="card-top">
          <div>
            <div class="area-tag">#${index + 1} • ${cust.area}</div>
            <div class="cust-title">${cust.name}</div>
          </div>
          <div class="packet-badge">${cust.defaultPacket} kg</div>
        </div>
        ${statusHtml}
        <div class="card-actions">
          <button class="btn-deliver" onclick="markDelivered('${cust.id}')">
            ✓ Delivered
          </button>
          <button class="btn-skip" onclick="markSkip('${cust.id}')">
            ✕ Chutti
          </button>
          <button class="btn-extra" onclick="openExtraModal('${cust.id}')">
            + Extra/Item
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

window.markDelivered = function (custId) {
  const cust = state.customers.find((c) => c.id === custId);
  if (!cust) return;
  if (!state.deliveries[selectedDate]) state.deliveries[selectedDate] = {};

  state.deliveries[selectedDate][custId] = {
    status: "delivered",
    milkKg: cust.defaultPacket,
    itemName: "",
    itemPrice: 0,
  };
  saveState();
  refreshAll();
};

window.markSkip = function (custId) {
  if (!state.deliveries[selectedDate]) state.deliveries[selectedDate] = {};
  state.deliveries[selectedDate][custId] = {
    status: "skip",
    milkKg: 0,
    itemName: "",
    itemPrice: 0,
  };
  saveState();
  refreshAll();
};

window.openExtraModal = function (custId) {
  const cust = state.customers.find((c) => c.id === custId);
  if (!cust) return;
  const existing = state.deliveries[selectedDate]?.[custId];

  document.getElementById("extraCustId").value = custId;
  document.getElementById("extraModalTitle").textContent =
    `${cust.name} - Extra / Product`;
  document.getElementById("extraMilkPacket").value = existing
    ? String(existing.milkKg)
    : String(cust.defaultPacket);
  document.getElementById("extraItemName").value = existing?.itemName || "";
  document.getElementById("extraItemPrice").value = existing?.itemPrice || "";

  document.getElementById("extraModal").classList.remove("hidden");
};

document.getElementById("extraForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const custId = document.getElementById("extraCustId").value;
  const milkKg = parseFloat(document.getElementById("extraMilkPacket").value);
  const itemName = document.getElementById("extraItemName").value.trim();
  const itemPrice =
    parseFloat(document.getElementById("extraItemPrice").value) || 0;

  if (!state.deliveries[selectedDate]) state.deliveries[selectedDate] = {};
  state.deliveries[selectedDate][custId] = {
    status: "delivered",
    milkKg,
    itemName: itemName || (itemPrice > 0 ? "Dairy Product" : ""),
    itemPrice,
  };

  saveState();
  document.getElementById("extraModal").classList.add("hidden");
  refreshAll();
});

// Stock Editor Modal
document.getElementById("editStockBtn").addEventListener("click", () => {
  const stk = getStockForDate(selectedDate);
  document.getElementById("stk2").value = stk["2"];
  document.getElementById("stk1_5").value = stk["1.5"];
  document.getElementById("stk1").value = stk["1"];
  document.getElementById("stk0_75").value = stk["0.75"];
  document.getElementById("stk0_5").value = stk["0.5"];
  document.getElementById("stockModal").classList.remove("hidden");
});

document.getElementById("setMaxStockBtn").addEventListener("click", () => {
  document.getElementById("stk2").value = 4;
  document.getElementById("stk1_5").value = 6;
  document.getElementById("stk1").value = 18;
  document.getElementById("stk0_75").value = 1;
  document.getElementById("stk0_5").value = 6;
});

document.getElementById("stockForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.dailyStock[selectedDate] = {
    2: parseInt(document.getElementById("stk2").value, 10) || 0,
    1.5: parseInt(document.getElementById("stk1_5").value, 10) || 0,
    1: parseInt(document.getElementById("stk1").value, 10) || 0,
    0.75: parseInt(document.getElementById("stk0_75").value, 10) || 0,
    0.5: parseInt(document.getElementById("stk0_5").value, 10) || 0,
  };
  saveState();
  document.getElementById("stockModal").classList.add("hidden");
  renderStockBar();
});

// Monthly Hisab Rendering
function renderHisab() {
  const monthStr = document.getElementById("hisabMonthPicker").value;
  const hisabList = document.getElementById("hisabList");
  let grandTotalBill = 0;
  let grandTotalPaid = 0;

  hisabList.innerHTML = state.customers
    .map((cust) => {
      let totalKg = 0;
      let extraTotal = 0;
      let daysDelivered = 0;

      Object.entries(state.deliveries).forEach(([dateKey, dayMap]) => {
        if (dateKey.startsWith(monthStr) && dayMap[cust.id]) {
          const rec = dayMap[cust.id];
          if (rec.status === "delivered") {
            daysDelivered++;
            totalKg += rec.milkKg;
            extraTotal += rec.itemPrice || 0;
          }
        }
      });

      const billAmount = totalKg * MILK_RATE + extraTotal;
      const custPayments = state.payments[monthStr]?.[cust.id] || [];
      const paidAmount = custPayments.reduce((sum, p) => sum + p.amount, 0);
      const balance = billAmount - paidAmount;

      grandTotalBill += billAmount;
      grandTotalPaid += paidAmount;

      return `
      <div class="card">
        <div class="card-top">
          <div>
            <div class="area-tag">${cust.area}</div>
            <div class="cust-title">${cust.name}</div>
            <div class="muted-text">${daysDelivered} din • ${totalKg} kg dudh + ₹${extraTotal} extra</div>
          </div>
          <div class="packet-badge">₹${billAmount}</div>
        </div>
        <div class="hisab-stats">
          <div>Total Bill<strong>₹${billAmount}</strong></div>
          <div>Jama (Paid)<strong style="color:var(--success)">₹${paidAmount}</strong></div>
          <div>Baaki<strong style="color:${balance > 0 ? "var(--danger)" : "var(--success)"}">₹${balance}</strong></div>
        </div>
        <div class="btn-row">
          <button class="btn-primary" onclick="openPaymentModal('${cust.id}')">+ Payment Jama</button>
          <button class="btn-secondary" onclick="shareWhatsApp('${cust.id}', '${monthStr}', ${totalKg}, ${extraTotal}, ${billAmount}, ${paidAmount}, ${balance})">WhatsApp Bill</button>
        </div>
      </div>
    `;
    })
    .join("");

  document.getElementById("monthGrandTotal").textContent =
    `Mahina (${monthStr}) Total Bill: ₹${grandTotalBill} | Jama: ₹${grandTotalPaid} | Baaki: ₹${grandTotalBill - grandTotalPaid}`;
}

window.openPaymentModal = function (custId) {
  const cust = state.customers.find((c) => c.id === custId);
  if (!cust) return;
  document.getElementById("payCustId").value = custId;
  document.getElementById("paymentModalTitle").textContent =
    `${cust.name} - Payment Entry`;
  document.getElementById("payAmount").value = "";
  document.getElementById("paymentModal").classList.remove("hidden");
};

document.getElementById("paymentForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const custId = document.getElementById("payCustId").value;
  const amount = parseFloat(document.getElementById("payAmount").value) || 0;
  const mode = document.getElementById("payMode").value;
  const monthStr = document.getElementById("hisabMonthPicker").value;

  if (!state.payments[monthStr]) state.payments[monthStr] = {};
  if (!state.payments[monthStr][custId]) state.payments[monthStr][custId] = [];

  state.payments[monthStr][custId].push({
    amount,
    mode,
    date: getTodayStr(),
  });

  saveState();
  document.getElementById("paymentModal").classList.add("hidden");
  renderHisab();
});

window.shareWhatsApp = function (
  custId,
  monthStr,
  kg,
  extra,
  bill,
  paid,
  balance,
) {
  const cust = state.customers.find((c) => c.id === custId);
  const msg = `Namaste ${cust.name},\nMahina (${monthStr}) ka Dudh Hisab:\n• Total Dudh: ${kg} kg (₹${kg * MILK_RATE})\n• Extra Items: ₹${extra}\n• Total Bill: ₹${bill}\n• Jama: ₹${paid}\n• Baaki Balance: ₹${balance}\nDhanyavaad!`;
  const cleanPhone = (cust.phone || "").replace(/\D/g, "");
  const phonePrefix = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const url = phonePrefix
    ? `https://wa.me/${phonePrefix}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
};

// Manage Customers & Backup
function renderManageCustomers() {
  const container = document.getElementById("manageCustomerList");
  container.innerHTML = state.customers
    .map(
      (c, i) => `
    <div class="card">
      <div class="card-top">
        <div>
          <div class="area-tag">#${i + 1} • ${c.area}</div>
          <div class="cust-title">${c.name}</div>
          <div class="muted-text">Roz: ${c.defaultPacket} kg ${c.phone ? `• 📞 ${c.phone}` : ""}</div>
        </div>
        <button class="btn-skip" onclick="deleteCustomer('${c.id}')">Delete</button>
      </div>
    </div>
  `,
    )
    .join("");
}

document.getElementById("addCustomerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const limit = state.maxCustomers || DEFAULT_MAX_CUSTOMERS;
  if (state.customers.length >= limit) {
    alert(`Maximum ${limit} customers hi add ho sakte hain!`);
    return;
  }
  const area = document.getElementById("custArea").value.trim();
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const defaultPacket = parseFloat(document.getElementById("custPacket").value);

  state.customers.push({
    id: "c_" + Date.now(),
    area,
    name,
    phone,
    defaultPacket,
  });

  saveState();
  e.target.reset();
  refreshAll();
  alert("Naya customer route mein jud gaya!");
});

window.deleteCustomer = function (custId) {
  if (!confirm("Kya aap is customer ko list se hatana chahte hain?")) return;
  state.customers = state.customers.filter((c) => c.id !== custId);
  saveState();
  refreshAll();
};
function renderLimitSetting() {
  const limit = state.maxCustomers || DEFAULT_MAX_CUSTOMERS;
  const input = document.getElementById("maxCustomerLimitInput");
  if (input) input.value = limit;

  const heading =
    document.querySelector("#addCustomerForm").previousElementSibling;
  if (heading && heading.tagName === "H3") {
    heading.textContent = `+ Naya Customer Jodein (Max ${limit})`;
  }
}

document.getElementById("saveLimitBtn").addEventListener("click", () => {
  const val = parseInt(
    document.getElementById("maxCustomerLimitInput").value,
    10,
  );
  if (!val || val < state.customers.length) {
    alert(
      `Limit kam se kam abhi ke customers (${state.customers.length}) ke barabar ya usse zyada rakhein.`,
    );
    return;
  }
  state.maxCustomers = val;
  saveState();
  renderLimitSetting();
  alert(`Maximum customer limit ${val} set ho gayi!`);
});

// Export & Import JSON Backup
document.getElementById("exportDataBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `milk-hisab-backup-${getTodayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importDataInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (imported.customers && imported.deliveries) {
        state = imported;
        saveState();
        refreshAll();
        alert("Backup successfully restore ho gaya!");
      } else {
        alert("Galat backup file hai.");
      }
    } catch {
      alert("File padhne mein error aaya.");
    }
  };
  reader.readAsText(file);
});

document.getElementById("resetDemoBtn").addEventListener("click", () => {
  if (
    !confirm("Saara data reset karke shuruati 6 customers par wapas aana hai?")
  )
    return;
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  refreshAll();
});

// Tabs & Modal Close Handlers
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "hisabTab") renderHisab();
    if (btn.dataset.tab === "manageTab") renderManageCustomers();
  });
});

document.querySelectorAll(".close-modal").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.close).classList.add("hidden");
  });
});

document
  .getElementById("deliveryDatePicker")
  .addEventListener("change", (e) => {
    selectedDate = e.target.value;
    document.getElementById("currentDateText").textContent =
      `Evening Route: ${selectedDate}`;
    refreshAll();
  });

document
  .getElementById("searchCustomerInput")
  .addEventListener("input", renderRouteList);

document
  .getElementById("hisabMonthPicker")
  .addEventListener("change", renderHisab);

function refreshAll() {
  renderStockBar();
  renderRouteList();
  renderHisab();
  renderManageCustomers();
  renderLimitSetting(); // <-- Ye line add karein
}
// Init App
document.getElementById("deliveryDatePicker").value = selectedDate;
document.getElementById("hisabMonthPicker").value = selectedDate.slice(0, 7);
document.getElementById("currentDateText").textContent =
  `Evening Route: ${selectedDate}`;
refreshAll();
