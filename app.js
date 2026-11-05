/**
 * SCSL2 Item & Price Catalog Explorer
 * Vanilla JavaScript Application Logic
 */

(function () {
  'use strict';

  // State Management
  let allItems = [];
  let filteredItems = [];
  let currentPage = 1;
  let pageSize = 25;
  let currentSort = { column: null, direction: 'asc' };
  let currentView = 'table'; // 'table' or 'cards'
  let debounceTimer = null;

  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const sheetFilter = document.getElementById('sheetFilter');
  const categoryFilter = document.getElementById('categoryFilter');
  const brandFilter = document.getElementById('brandFilter');
  const statusFilter = document.getElementById('statusFilter');
  const priceTypeFilter = document.getElementById('priceTypeFilter');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const emptyResetBtn = document.getElementById('emptyResetBtn');

  // KPI Elements
  const kpiTotalItems = document.getElementById('kpiTotalItems');
  const kpiTotalFiltered = document.getElementById('kpiTotalFiltered');
  const kpiCategories = document.getElementById('kpiCategories');
  const kpiBrands = document.getElementById('kpiBrands');
  const kpiPricedItems = document.getElementById('kpiPricedItems');
  const kpiAvgPrice = document.getElementById('kpiAvgPrice');

  // View Containers
  const resultsCount = document.getElementById('resultsCount');
  const tableContainer = document.getElementById('tableContainer');
  const itemsTableBody = document.getElementById('itemsTableBody');
  const cardsContainer = document.getElementById('cardsContainer');
  const emptyState = document.getElementById('emptyState');
  const paginationFooter = document.getElementById('paginationFooter');

  // Toolbar & View Buttons
  const tableViewBtn = document.getElementById('tableViewBtn');
  const cardsViewBtn = document.getElementById('cardsViewBtn');
  const pageSizeSelect = document.getElementById('pageSizeSelect');

  // Pagination Controls
  const pageInfo = document.getElementById('pageInfo');
  const firstPageBtn = document.getElementById('firstPageBtn');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const lastPageBtn = document.getElementById('lastPageBtn');
  const pageJumpInput = document.getElementById('pageJumpInput');
  const totalPagesSpan = document.getElementById('totalPagesSpan');

  // Dialog & Modal Elements
  const itemModal = document.getElementById('itemModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const closeModalBottomBtn = document.getElementById('closeModalBottomBtn');
  const copyAllDetailsBtn = document.getElementById('copyAllDetailsBtn');

  // Theme & File Upload
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const excelFileInput = document.getElementById('excelFileInput');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const toast = document.getElementById('toast');
  const dataSourceLabel = document.getElementById('dataSourceLabel');

  let activeModalItem = null;

  // Initialize
  function init() {
    initTheme();
    loadDefaultData();
    setupEventListeners();
  }

  // Load Pre-extracted Data
  function loadDefaultData() {
    if (window.DEFAULT_ITEMS_DATA && Array.isArray(window.DEFAULT_ITEMS_DATA)) {
      setDataset(window.DEFAULT_ITEMS_DATA, 'Source: SCSL2-CLR PRICE-26.xlsx (Embedded)');
    } else {
      showToast('⚠️ No items data found. Please load an Excel file.', 4000);
    }
  }

  // Set Dataset & Rebuild Indexes
  function setDataset(rawItems, sourceName) {
    if (sourceName && dataSourceLabel) {
      dataSourceLabel.textContent = sourceName;
    }

    allItems = rawItems.map((item, idx) => {
      // Build lowercase composite string for ultra-fast multi-keyword searching
      const searchIndex = [
        item.itemCode || '',
        item.itemDesc || '',
        item.model || '',
        item.brandDesc || '',
        item.brandCd || '',
        item.cat1Desc || '',
        item.cat2Desc || '',
        item.cat1 || '',
        item.cat2 || '',
        item.ser1 || '',
        item.ser2 || '',
        item.locDesc || '',
        item.status || '',
        item.clsPriceRaw || ''
      ].join(' ').toLowerCase();

      return {
        ...item,
        id: item.id || idx + 1,
        _searchIndex: searchIndex
      };
    });

    populateDropdowns();
    updateKpis();
    applyFilters();
  }

  // Populate Filter Dropdowns
  function populateDropdowns() {
    // Categories
    const categoryCounts = {};
    const brandCounts = {};

    allItems.forEach(item => {
      const cat = item.cat1Desc || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      const brand = item.brandDesc || 'Other';
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    });

    // Populate Category select
    categoryFilter.innerHTML = '<option value="ALL">All Categories</option>';
    Object.keys(categoryCounts)
      .sort((a, b) => categoryCounts[b] - categoryCounts[a])
      .forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = `${cat} (${categoryCounts[cat]})`;
        categoryFilter.appendChild(opt);
      });

    // Populate Brand select
    brandFilter.innerHTML = '<option value="ALL">All Brands</option>';
    Object.keys(brandCounts)
      .sort((a, b) => brandCounts[b] - brandCounts[a])
      .forEach(brand => {
        const opt = document.createElement('option');
        opt.value = brand;
        opt.textContent = `${brand} (${brandCounts[brand]})`;
        brandFilter.appendChild(opt);
      });
  }

  // Update KPI Cards
  function updateKpis() {
    const total = allItems.length;
    kpiTotalItems.textContent = total.toLocaleString();

    const distinctCats = new Set(allItems.map(i => i.cat1Desc).filter(Boolean)).size;
    kpiCategories.textContent = distinctCats;

    const distinctBrands = new Set(allItems.map(i => i.brandDesc).filter(Boolean)).size;
    kpiBrands.textContent = distinctBrands;

    const pricedItems = allItems.filter(i => typeof i.clsPrice === 'number' && i.clsPrice > 0);
    kpiPricedItems.textContent = pricedItems.length.toLocaleString();

    if (pricedItems.length > 0) {
      const sum = pricedItems.reduce((acc, i) => acc + i.clsPrice, 0);
      const avg = Math.round(sum / pricedItems.length);
      kpiAvgPrice.textContent = `Avg: LKR ${avg.toLocaleString()}`;
    } else {
      kpiAvgPrice.textContent = 'No priced items';
    }
  }

  // Filter & Search Engine
  function applyFilters() {
    const query = (searchInput.value || '').trim().toLowerCase();
    const sheetVal = sheetFilter.value;
    const categoryVal = categoryFilter.value;
    const brandVal = brandFilter.value;
    const statusVal = statusFilter.value;
    const priceTypeVal = priceTypeFilter.value;

    // Show/hide clear search button
    clearSearchBtn.style.display = query ? 'block' : 'none';

    // Split search into tokens for fuzzy multi-word match
    const tokens = query ? query.split(/\s+/).filter(Boolean) : [];

    filteredItems = allItems.filter(item => {
      // 1. Text Search Filter (every token must be found in the item's search index)
      if (tokens.length > 0) {
        const matched = tokens.every(token => item._searchIndex.includes(token));
        if (!matched) return false;
      }

      // 2. Sheet Filter
      if (sheetVal !== 'ALL' && item.sheet !== sheetVal) {
        return false;
      }

      // 3. Category Filter
      if (categoryVal !== 'ALL') {
        const itemCat = item.cat1Desc || 'Other';
        if (itemCat !== categoryVal) return false;
      }

      // 4. Brand Filter
      if (brandVal !== 'ALL') {
        const itemBrand = item.brandDesc || 'Other';
        if (itemBrand !== brandVal) return false;
      }

      // 5. Status Filter
      if (statusVal !== 'ALL' && item.status !== statusVal) {
        return false;
      }

      // 6. Price Filter
      const price = item.clsPrice;
      if (priceTypeVal === 'HAS_PRICE') {
        if (typeof price !== 'number' || price <= 0) return false;
      } else if (priceTypeVal === 'NO_PRICE') {
        if (typeof price === 'number' && price > 0) return false;
      } else if (priceTypeVal === 'UNDER_10K') {
        if (typeof price !== 'number' || price >= 10000) return false;
      } else if (priceTypeVal === '10K_50K') {
        if (typeof price !== 'number' || price < 10000 || price > 50000) return false;
      } else if (priceTypeVal === '50K_100K') {
        if (typeof price !== 'number' || price < 50000 || price > 100000) return false;
      } else if (priceTypeVal === 'OVER_100K') {
        if (typeof price !== 'number' || price <= 100000) return false;
      }

      return true;
    });

    // Update KPI filter hint
    kpiTotalFiltered.textContent = `${filteredItems.length.toLocaleString()} matching filters`;

    // Apply Sorting if active
    if (currentSort.column) {
      sortData(currentSort.column, currentSort.direction, false);
    }

    currentPage = 1;
    renderResults();
  }

  // Sorting
  function sortData(column, direction, reRender = true) {
    currentSort = { column, direction };

    filteredItems.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];

      // Price comparison
      if (column === 'clsPrice' || column === 'sellPrice' || column === 'qty') {
        valA = typeof valA === 'number' ? valA : -1;
        valB = typeof valB === 'number' ? valB : -1;
        return direction === 'asc' ? valA - valB : valB - valA;
      }

      // String comparison
      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    // Update UI headers
    document.querySelectorAll('.items-table th.sortable').forEach(th => {
      const col = th.getAttribute('data-sort');
      const icon = th.querySelector('.sort-icon');
      if (col === column) {
        icon.textContent = direction === 'asc' ? '▲' : '▼';
        th.style.color = 'var(--primary)';
      } else {
        icon.textContent = '';
        th.style.color = '';
      }
    });

    if (reRender) {
      renderResults();
    }
  }

  // Render View (Table or Cards)
  function renderResults() {
    const totalCount = filteredItems.length;

    // Results count banner
    resultsCount.innerHTML = `Showing <strong>${totalCount.toLocaleString()}</strong> item${totalCount === 1 ? '' : 's'}`;

    if (totalCount === 0) {
      tableContainer.style.display = 'none';
      cardsContainer.style.display = 'none';
      emptyState.style.display = 'flex';
      paginationFooter.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    paginationFooter.style.display = 'flex';

    // Pagination calculations
    const effectivePageSize = pageSize === 'ALL' ? totalCount : parseInt(pageSize, 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / effectivePageSize));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * effectivePageSize;
    const endIndex = Math.min(startIndex + effectivePageSize, totalCount);
    const pageItems = filteredItems.slice(startIndex, endIndex);

    // Update Pagination UI
    pageInfo.textContent = `Showing ${startIndex + 1} - ${endIndex} of ${totalCount.toLocaleString()}`;
    totalPagesSpan.textContent = totalPages;
    pageJumpInput.value = currentPage;
    pageJumpInput.max = totalPages;

    firstPageBtn.disabled = currentPage === 1;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
    lastPageBtn.disabled = currentPage >= totalPages;

    if (currentView === 'table') {
      tableContainer.style.display = 'block';
      cardsContainer.style.display = 'none';
      renderTable(pageItems);
    } else {
      tableContainer.style.display = 'none';
      cardsContainer.style.display = 'grid';
      renderCards(pageItems);
    }
  }

  // Helper for Formatting Prices
  function formatPrice(val, raw) {
    if (typeof val === 'number' && !isNaN(val)) {
      return `LKR ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (raw && raw !== '0' && raw !== '') {
      return raw;
    }
    return 'N/A';
  }

  // Render Table Rows
  function renderTable(items) {
    itemsTableBody.innerHTML = '';

    const fragment = document.createDocumentFragment();

    items.forEach(item => {
      const tr = document.createElement('tr');
      tr.addEventListener('click', () => openItemModal(item));

      const hasPrice = typeof item.clsPrice === 'number' && item.clsPrice > 0;
      const formattedCls = formatPrice(item.clsPrice, item.clsPriceRaw);

      tr.innerHTML = `
        <td><span class="sheet-badge ${item.sheet}">${item.sheet}</span></td>
        <td><span class="code-badge">${escapeHtml(item.itemCode || '-')}</span></td>
        <td><strong>${escapeHtml(item.itemDesc || '-')}</strong></td>
        <td>${escapeHtml(item.brandDesc || item.brandCd || '-')}</td>
        <td><code>${escapeHtml(item.model || '-')}</code></td>
        <td>${escapeHtml(item.cat1Desc || '-')}</td>
        <td><span class="serial-tag">${escapeHtml(item.ser1 || '-')}</span></td>
        <td class="center">${item.qty}</td>
        <td class="right">
          <span class="price-tag ${hasPrice ? 'has-price' : 'no-price'}">
            ${formattedCls}
          </span>
        </td>
        <td class="center">
          <button class="btn btn-sm btn-outline view-btn" title="View full details">View</button>
        </td>
      `;

      fragment.appendChild(tr);
    });

    itemsTableBody.appendChild(fragment);
  }

  // Render Cards Grid
  function renderCards(items) {
    cardsContainer.innerHTML = '';

    const fragment = document.createDocumentFragment();

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.addEventListener('click', () => openItemModal(item));

      const hasPrice = typeof item.clsPrice === 'number' && item.clsPrice > 0;
      const formattedCls = formatPrice(item.clsPrice, item.clsPriceRaw);

      card.innerHTML = `
        <div class="card-top">
          <span class="code-badge">${escapeHtml(item.itemCode || '-')}</span>
          <div class="card-badges">
            <span class="sheet-badge ${item.sheet}">${item.sheet}</span>
            <span class="badge badge-status">${escapeHtml(item.status || 'CLR')}</span>
          </div>
        </div>

        <h4 class="card-title">${escapeHtml(item.itemDesc || '-')}</h4>

        <div class="card-meta-list">
          <div class="card-meta-item">
            <span class="card-meta-label">Brand:</span>
            <strong>${escapeHtml(item.brandDesc || item.brandCd || '-')}</strong>
          </div>
          <div class="card-meta-item">
            <span class="card-meta-label">Model:</span>
            <code>${escapeHtml(item.model || '-')}</code>
          </div>
          <div class="card-meta-item">
            <span class="card-meta-label">Category:</span>
            <span>${escapeHtml(item.cat1Desc || '-')}</span>
          </div>
          <div class="card-meta-item">
            <span class="card-meta-label">Serial (SER1):</span>
            <span class="serial-tag">${escapeHtml(item.ser1 || '-')}</span>
          </div>
        </div>

        <div class="card-footer">
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">CLS Price</div>
            <div class="price-tag ${hasPrice ? 'has-price' : 'no-price'}">${formattedCls}</div>
          </div>
          <button class="btn btn-sm btn-primary">Details</button>
        </div>
      `;

      fragment.appendChild(card);
    });

    cardsContainer.appendChild(fragment);
  }

  // Open Item Detail Modal
  function openItemModal(item) {
    activeModalItem = item;

    document.getElementById('modalSheetBadge').textContent = item.sheet;
    document.getElementById('modalSheetBadge').className = `badge sheet-badge ${item.sheet}`;
    document.getElementById('modalStatusBadge').textContent = item.status || 'CLR';

    document.getElementById('modalTitle').textContent = item.itemDesc || 'Item Details';
    document.getElementById('modalItemCode').textContent = item.itemCode || '-';
    document.getElementById('modalModel').textContent = item.model || '-';
    document.getElementById('modalDesc').textContent = item.itemDesc || '-';
    document.getElementById('modalBrand').textContent = `${item.brandDesc || ''} (${item.brandCd || ''})`.trim() || '-';
    document.getElementById('modalCat1').textContent = `${item.cat1Desc || ''} (${item.cat1 || ''})`.trim() || '-';
    document.getElementById('modalCat2').textContent = `${item.cat2Desc || ''} (${item.cat2 || ''})`.trim() || '-';
    document.getElementById('modalCat3').textContent = item.cat3 || 'N/A';

    document.getElementById('modalSer1').textContent = item.ser1 || 'N/A';

    const modalSer2Wrapper = document.getElementById('modalSer2Wrapper');
    if (item.ser2 && item.ser2 !== 'N/A' && item.ser2 !== '') {
      modalSer2Wrapper.style.display = 'flex';
      document.getElementById('modalSer2').textContent = item.ser2;
    } else {
      modalSer2Wrapper.style.display = 'none';
    }

    document.getElementById('modalLocation').textContent = `${item.locDesc || ''} [${item.locCd || ''}]`.trim() || '-';
    document.getElementById('modalCompany').textContent = `${item.comDesc || ''} [${item.comCd || ''}]`.trim() || '-';

    document.getElementById('modalClsPrice').textContent = formatPrice(item.clsPrice, item.clsPriceRaw);
    document.getElementById('modalSellPrice').textContent = formatPrice(item.sellPrice, item.sellPriceRaw);
    document.getElementById('modalQty').textContent = item.qty || '1';

    if (typeof itemModal.showModal === 'function') {
      itemModal.showModal();
    } else {
      itemModal.setAttribute('open', '');
    }
  }

  // Close Modal
  function closeModal() {
    if (typeof itemModal.close === 'function') {
      itemModal.close();
    } else {
      itemModal.removeAttribute('open');
    }
    activeModalItem = null;
  }

  // Copy Text to Clipboard
  function copyToClipboard(text, successMsg) {
    if (!text || text === '-' || text === 'N/A') return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg || 'Copied to clipboard!');
      }).catch(() => {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg || 'Copied to clipboard!');
    } catch (err) {
      showToast('Could not copy automatically', 2000);
    }
    document.body.removeChild(textArea);
  }

  // Toast Notification
  function showToast(message, duration = 2500) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // Export Filtered Items to CSV
  function exportToCsv() {
    if (filteredItems.length === 0) {
      showToast('No items to export.');
      return;
    }

    const headers = [
      'Sheet',
      'Row',
      'Item Code',
      'Description',
      'Brand',
      'Model',
      'Category 1',
      'Category 2',
      'Serial 1',
      'Serial 2',
      'Status',
      'Quantity',
      'CLS Price',
      'Sell Price',
      'Location'
    ];

    const rows = filteredItems.map(i => [
      i.sheet,
      i.rowNum,
      `"${(i.itemCode || '').replace(/"/g, '""')}"`,
      `"${(i.itemDesc || '').replace(/"/g, '""')}"`,
      `"${(i.brandDesc || '').replace(/"/g, '""')}"`,
      `"${(i.model || '').replace(/"/g, '""')}"`,
      `"${(i.cat1Desc || '').replace(/"/g, '""')}"`,
      `"${(i.cat2Desc || '').replace(/"/g, '""')}"`,
      `"${(i.ser1 || '').replace(/"/g, '""')}"`,
      `"${(i.ser2 || '').replace(/"/g, '""')}"`,
      `"${(i.status || '').replace(/"/g, '""')}"`,
      i.qty,
      i.clsPriceRaw || i.clsPrice || '',
      i.sellPriceRaw || i.sellPrice || '',
      `"${(i.locDesc || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SCSL2_CLR_PRICE_EXPORT_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${filteredItems.length.toLocaleString()} items to CSV!`);
  }

  // Handle Dynamic Excel File Upload
  function handleExcelUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
      showToast('⚠️ Excel parser library (SheetJS) is not loaded. Please connect to internet or use embedded dataset.', 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const importedItems = [];
        let idCounter = 0;

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          if (!jsonRows || jsonRows.length <= 1) return;

          const headerRow = jsonRows[0].map(h => (h || '').toString().trim());

          for (let r = 1; r < jsonRows.length; r++) {
            const row = jsonRows[r];
            if (!row || row.length === 0) continue;

            const rowMap = {};
            headerRow.forEach((colName, cIdx) => {
              rowMap[colName] = row[cIdx] !== undefined ? row[cIdx] : '';
            });

            idCounter++;
            const clsPriceRaw = rowMap['CLS PRICE'] !== undefined ? String(rowMap['CLS PRICE']) : '';
            const sellPriceRaw = rowMap['SELL_PRICE'] !== undefined ? String(rowMap['SELL_PRICE']) : '';
            const qtyRaw = rowMap['TOT_QTY'] !== undefined ? rowMap['TOT_QTY'] : 1;

            const clsNum = !isNaN(parseFloat(clsPriceRaw)) ? parseFloat(clsPriceRaw) : null;
            const sellNum = !isNaN(parseFloat(sellPriceRaw)) ? parseFloat(sellPriceRaw) : null;
            const qtyNum = !isNaN(parseInt(qtyRaw, 10)) ? parseInt(qtyRaw, 10) : 1;

            importedItems.push({
              id: idCounter,
              sheet: sheetName,
              rowNum: r + 1,
              comCd: String(rowMap['COM_CD'] || ''),
              comDesc: String(rowMap['COM_DESC'] || ''),
              poweredBy: String(rowMap['POWERED_BY'] || ''),
              locCd: String(rowMap['LOC_CD'] || ''),
              locDesc: String(rowMap['LOC_DESC'] || ''),
              cat1: String(rowMap['ITM_CAT1'] || ''),
              cat1Desc: String(rowMap['ITM_CAT1_DESC'] || ''),
              cat2: String(rowMap['ITM_CAT2'] || ''),
              cat2Desc: String(rowMap['ITM_CAT2_DESC'] || ''),
              cat3: String(rowMap['ITM_CAT3'] || ''),
              itemCode: String(rowMap['ITM_CD'] || ''),
              itemDesc: String(rowMap['ITM_DESC'] || ''),
              model: String(rowMap['ITM_MODEL'] || ''),
              brandCd: String(rowMap['ITM_BRAND'] || ''),
              brandDesc: String(rowMap['BRAND_DESC'] || ''),
              status: String(rowMap['ITM_STATUS'] || ''),
              qty: qtyNum,
              sellPriceRaw: sellPriceRaw,
              sellPrice: sellNum,
              clsPriceRaw: clsPriceRaw,
              clsPrice: clsNum,
              ser1: String(rowMap['SER1'] || ''),
              ser2: String(rowMap['SER2'] || '')
            });
          }
        });

        if (importedItems.length > 0) {
          setDataset(importedItems, `Uploaded: ${file.name}`);
          showToast(`Successfully loaded ${importedItems.length.toLocaleString()} items from ${file.name}!`);
        } else {
          showToast('Could not find item rows in the uploaded file.', 3000);
        }
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        showToast('Error reading Excel file. Check format.', 3000);
      }
    };

    reader.readAsArrayBuffer(file);
    // Reset file input so same file can be re-selected if needed
    event.target.value = '';
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Search input debounced
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        applyFilters();
      }, 150);
    });

    // Clear search
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      applyFilters();
      searchInput.focus();
    });

    // Filter selects
    [sheetFilter, categoryFilter, brandFilter, statusFilter, priceTypeFilter].forEach(select => {
      select.addEventListener('change', () => applyFilters());
    });

    // Reset Filters
    function resetAllFilters() {
      searchInput.value = '';
      sheetFilter.value = 'ALL';
      categoryFilter.value = 'ALL';
      brandFilter.value = 'ALL';
      statusFilter.value = 'ALL';
      priceTypeFilter.value = 'ALL';
      applyFilters();
      showToast('Filters reset to default.');
    }

    resetFiltersBtn.addEventListener('click', resetAllFilters);
    emptyResetBtn.addEventListener('click', resetAllFilters);

    // Table Header Sorting
    document.querySelectorAll('.items-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        const direction = currentSort.column === col && currentSort.direction === 'asc' ? 'desc' : 'asc';
        sortData(col, direction, true);
      });
    });

    // View toggle
    tableViewBtn.addEventListener('click', () => {
      currentView = 'table';
      tableViewBtn.classList.add('active');
      cardsViewBtn.classList.remove('active');
      renderResults();
    });

    cardsViewBtn.addEventListener('click', () => {
      currentView = 'cards';
      cardsViewBtn.classList.add('active');
      tableViewBtn.classList.remove('active');
      renderResults();
    });

    // Page size change
    pageSizeSelect.addEventListener('change', (e) => {
      pageSize = e.target.value;
      currentPage = 1;
      renderResults();
    });

    // Pagination navigation
    firstPageBtn.addEventListener('click', () => {
      currentPage = 1;
      renderResults();
    });

    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderResults();
      }
    });

    nextPageBtn.addEventListener('click', () => {
      const effectiveSize = pageSize === 'ALL' ? filteredItems.length : parseInt(pageSize, 10);
      const totalPages = Math.ceil(filteredItems.length / effectiveSize);
      if (currentPage < totalPages) {
        currentPage++;
        renderResults();
      }
    });

    lastPageBtn.addEventListener('click', () => {
      const effectiveSize = pageSize === 'ALL' ? filteredItems.length : parseInt(pageSize, 10);
      currentPage = Math.ceil(filteredItems.length / effectiveSize);
      renderResults();
    });

    pageJumpInput.addEventListener('change', (e) => {
      const page = parseInt(e.target.value, 10);
      const effectiveSize = pageSize === 'ALL' ? filteredItems.length : parseInt(pageSize, 10);
      const totalPages = Math.ceil(filteredItems.length / effectiveSize);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        currentPage = page;
        renderResults();
      } else {
        pageJumpInput.value = currentPage;
      }
    });

    // Modal close
    closeModalBtn.addEventListener('click', closeModal);
    closeModalBottomBtn.addEventListener('click', closeModal);
    itemModal.addEventListener('click', (e) => {
      // Close on backdrop click
      if (e.target === itemModal) {
        closeModal();
      }
    });

    // Copy individual fields inside modal
    document.querySelectorAll('.copy-small-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-target');
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          copyToClipboard(targetEl.textContent.trim(), 'Copied to clipboard!');
        }
      });
    });

    // Copy All Details button
    copyAllDetailsBtn.addEventListener('click', () => {
      if (!activeModalItem) return;
      const itm = activeModalItem;
      const text = [
        '========================================',
        `ITEM: ${itm.itemDesc}`,
        '========================================',
        `Item Code:       ${itm.itemCode}`,
        `Model:           ${itm.model}`,
        `Brand:           ${itm.brandDesc} (${itm.brandCd})`,
        `Category:        ${itm.cat1Desc} / ${itm.cat2Desc}`,
        `Serial No 1:     ${itm.ser1}`,
        itm.ser2 ? `Serial No 2:     ${itm.ser2}` : '',
        `Status:          ${itm.status}`,
        `Clearance Price: ${formatPrice(itm.clsPrice, itm.clsPriceRaw)}`,
        `Selling Price:   ${formatPrice(itm.sellPrice, itm.sellPriceRaw)}`,
        `Quantity:        ${itm.qty}`,
        `Location:        ${itm.locDesc} (${itm.locCd})`,
        `Company:         ${itm.comDesc} (${itm.comCd})`,
        `Sheet / Row:     ${itm.sheet}, Row ${itm.rowNum}`,
        '========================================'
      ].filter(Boolean).join('\n');

      copyToClipboard(text, 'All item details copied to clipboard!');
    });

    // CSV Export
    exportCsvBtn.addEventListener('click', exportToCsv);

    // Dynamic Excel upload
    excelFileInput.addEventListener('change', handleExcelUpload);

    // Theme toggle
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Dark/Light Theme Support
  const SUN_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  const MOON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

  function initTheme() {
    const savedTheme = localStorage.getItem('scsl2_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeIcon.innerHTML = savedTheme === 'dark' ? SUN_SVG : MOON_SVG;
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('scsl2_theme', nextTheme);
    themeIcon.innerHTML = nextTheme === 'dark' ? SUN_SVG : MOON_SVG;
    showToast(`Switched to ${nextTheme} theme`);
  }

  // HTML Sanitizer
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
