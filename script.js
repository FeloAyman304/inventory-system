// ====== state ======
let products = JSON.parse(localStorage.getItem('products')) || [];
// alerts هنا هنستعملها "مؤقتة" للأخطاء اللحظية (ID مكرر باسم مختلف مثلاً)
let alerts = JSON.parse(localStorage.getItem('alerts')) || [];

// عناصر DOM (لو موجودة في الصفحة الحالية)
const productForm = document.getElementById('productForm');
const sellForm    = document.getElementById('sellForm');
const tableBody   = document.querySelector('#productTable tbody');
const alertCountEl= document.getElementById('alert-count');

// ====== helpers ======
const LOW_STOCK_THRESHOLD = 5;

function saveAll(){
  localStorage.setItem('products', JSON.stringify(products));
  localStorage.setItem('alerts', JSON.stringify(alerts));
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

// ====== جدول المنتجات ======
function renderTable(){
  if(!tableBody) return;
  tableBody.innerHTML = '';
  products.forEach(p=>{
    const tr = document.createElement('tr');
    if (p.quantity <= LOW_STOCK_THRESHOLD) tr.classList.add('low-stock');
    tr.innerHTML = `
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.id)}</td>
      <td>${p.quantity}</td>
    `;
    tableBody.appendChild(tr);
  });
}

// ====== إنذارات المخزون (مُولّدة من حالة المنتجات) ======
function stockAlerts(){
  // بترجع إنذارات مبنية على حالة المخزون فقط
  return products.flatMap(p=>{
    if (p.quantity === 0)  return [`❌ المنتج "${p.name}" نفد من المخزون (ID: ${p.id}).`];
    if (p.quantity <= LOW_STOCK_THRESHOLD) return [`⚠️ المنتج "${p.name}" كمية منخفضة (${p.quantity}) (ID: ${p.id}).`];
    return [];
  });
}

function updateAlertIcon(){
  if(!alertCountEl) return;
  const count = stockAlerts().length + alerts.length;
  alertCountEl.textContent = String(count);
}

// ====== إضافة/تحديث منتج ======
if (productForm){
  productForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const id   = String(document.getElementById('id').value).trim();
    const qty  = parseInt(document.getElementById('quantity').value, 10);

    if(!name || !id || isNaN(qty) || qty<=0){
      pushTempAlert('⚠️ أدخل اسمًا صحيحًا، رقمًا فريدًا، وكمية أكبر من صفر.');
      refreshUI();
      return;
    }

    // منع ID مكرر باسم مختلف
    const sameIdDifferentName = products.find(p => p.id===id && p.name!==name);
    if (sameIdDifferentName){
      pushTempAlert(`🚫 الرقم الفريد ${id} مستخدم للمنتج "${sameIdDifferentName.name}". غيّر الاسم أو ID.`);
      refreshUI();
      return;
    }

    // لو الاسم+ID موجودين → زود الكمية، غير كده أضف
    const existing = products.find(p => p.id===id && p.name===name);
    if (existing){
      existing.quantity += qty;
    } else {
      products.push({name, id, quantity: qty});
    }

    // بعد الإضافة، لو بقى فوق العتبة، ميمفّعش يبقى له إنذار مؤقت
    alerts = alerts.filter(a => !a.includes(`ID: ${id}`) && !a.includes(` ${id}.`));

    productForm.reset();
    refreshUI();
  });
}

// ====== سحب منتج ======
if (sellForm){
  sellForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const id  = String(document.getElementById('sellId').value).trim();
    const amt = parseInt(document.getElementById('sellAmount').value, 10);

    if(!id || isNaN(amt) || amt<=0){
      pushTempAlert('⚠️ أدخل رقم فريد صحيح وكمية أكبر من صفر.');
      refreshUI();
      return;
    }

    const product = products.find(p => p.id===id);
    if(!product){
      pushTempAlert(`🚫 المنتج برقم ${id} غير موجود.`);
      refreshUI();
      return;
    }

    if(product.quantity < amt){
      pushTempAlert(`⚠️ الكمية المطلوبة (${amt}) أكبر من المتاحة (${product.quantity}) للمنتج "${product.name}".`);
      refreshUI();
      return;
    }

    product.quantity -= amt;

    // لو خلص أو بالسالب، احذفه من القائمة
    if (product.quantity <= 0){
      products = products.filter(p => p.id !== id);
      // نظّف أي إنذار مؤقت متعلق به
      alerts = alerts.filter(a => !a.includes(`ID: ${id}`) && !a.includes(` ${id}.`));
    }

    sellForm.reset();
    refreshUI();
  });
}

// ====== إنذارات مؤقتة (للأخطاء اللحظية) ======
function pushTempAlert(msg){
  if(!alerts.includes(msg)) alerts.push(msg);
}

// ====== التنقل ======
function goToAlerts(){
  saveAll(); // حفظ قبل الانتقال
  window.location.href = 'alerts.html';
}

// ====== صفحة الإنذارات ======
(function initAlertsPageIfExists(){
  const listEl = document.getElementById('alerts-list');
  const countLabel = document.getElementById('alerts-count-label');
  const clearBtn = document.getElementById('clear-alerts-btn');

  if(!listEl) return; // مش في alerts.html

  function renderAlertsPage(){
    // اندماج بين إنذارات المخزون + المؤقتة
    const combined = [...stockAlerts(), ...alerts];
    countLabel.textContent = `عدد الإنذارات: ${combined.length}`;
    listEl.innerHTML = '';

    if (combined.length === 0){
      listEl.innerHTML = `<div class="alert-item"><span>لا توجد إنذارات.</span></div>`;
      return;
    }

    combined.forEach((txt)=>{
      const item = document.createElement('div');
      item.className = 'alert-item';
      item.innerHTML = `<span>${escapeHtml(txt)}</span><span class="meta">${new Date().toLocaleString()}</span>`;
      listEl.appendChild(item);
    });
  }

  if (clearBtn){
    clearBtn.addEventListener('click', ()=>{
      // نمسح فقط الإنذارات المؤقتة؛ إنذارات المخزون تتولد تلقائيًا حسب الحالة
      alerts = [];
      saveAll();
      renderAlertsPage();
    });
  }

  renderAlertsPage();
})();

// ====== تحديث شامل للواجهة ======
function refreshUI(){
  renderTable();
  updateAlertIcon();
  saveAll();
}

// ====== تشغيل أولي ======
refreshUI();

function sellProduct(id, amount) {
    let products = JSON.parse(localStorage.getItem("products")) || [];
    let productIndex = products.findIndex(p => p.id == id);

    if (productIndex === -1) {
        alert("المنتج غير موجود!");
        return;
    }

    if (products[productIndex].quantity < amount) {
        alert("الكمية غير كافية!");
        return;
    }

    products[productIndex].quantity -= amount;

    // لو الكمية صفر احذف المنتج
    if (products[productIndex].quantity === 0) {
        products.splice(productIndex, 1);
    }

    localStorage.setItem("products", JSON.stringify(products));
    renderProducts();
    checkAlerts();
}
document.getElementById("deleteAllBtn").addEventListener("click", function() {
    if (confirm("هل أنت متأكد أنك تريد حذف كل المنتجات؟")) {
        localStorage.removeItem("products");
        renderProducts();
        checkAlerts();
    }
});
function withdrawProduct(uniqueId, quantity) {
    let products = JSON.parse(localStorage.getItem("products")) || [];

    products = products.map(p => {
        if (p.id == uniqueId) {
            p.quantity -= quantity;
        }
        return p;
    }).filter(p => p.quantity > 0); // يحذف أي منتج كميته 0 أو أقل

    localStorage.setItem("products", JSON.stringify(products));
    renderProducts();
}
function showAlert(message, type = "success") {
    const alertBox = document.createElement("div");
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;

    document.body.appendChild(alertBox);

    // إزالة التنبيه بعد 2 ثانية
    setTimeout(() => {
        alertBox.remove();
    }, 2000);
}
