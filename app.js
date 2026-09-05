// Quản lý ứng dụng Chia Tiền Nhóm
(function () {
  'use strict';

  // Key lưu trữ LocalStorage
  const STORAGE_KEY = 'chia_tien_nhom_v1';

  // Khởi tạo state
  let state = {
    members: [],
    expenses: [],
    activeTab: 'members'
  };

  // Form state cho hóa đơn đang tạo
  let formExpenseState = {
    payer: '',
    splitters: new Set()
  };

  // DOM Elements
  const tabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const badgeMembers = document.getElementById('badge-members');
  const badgeExpenses = document.getElementById('badge-expenses');

  // Tab 1 Elements
  const formAddMember = document.getElementById('form-add-member');
  const inputMemberName = document.getElementById('input-member-name');
  const membersEmpty = document.getElementById('members-empty');
  const membersChipList = document.getElementById('members-chip-list');
  const btnGotoExpenses = document.getElementById('btn-goto-expenses');
  const quickNameBtns = document.querySelectorAll('.chip-quick');

  // Tab 2 Elements
  const formAddExpense = document.getElementById('form-add-expense');
  const inputExpenseTitle = document.getElementById('input-expense-title');
  const inputExpenseAmount = document.getElementById('input-expense-amount');
  const payerSelection = document.getElementById('payer-selection');
  const splitterSelection = document.getElementById('splitter-selection');
  const btnToggleAllSplitters = document.getElementById('btn-toggle-all-splitters');
  const splitPerPersonPreview = document.getElementById('split-per-person-preview');
  const expensesList = document.getElementById('expenses-list');
  const expensesEmpty = document.getElementById('expenses-empty');
  const expenseCount = document.getElementById('expense-count');
  const totalSpentAmount = document.getElementById('total-spent-amount');
  const quickAmountBtns = document.querySelectorAll('.chip-amount');

  // Tab 3 Elements
  const summaryTotalGroup = document.getElementById('summary-total-group');
  const summaryMemberCount = document.getElementById('summary-member-count');
  const settlementTransactionsList = document.getElementById('settlement-transactions-list');
  const memberBalanceList = document.getElementById('member-balance-list');
  const btnCopySummary = document.getElementById('btn-copy-summary');

  // Header Actions
  const btnSample = document.getElementById('btn-sample');
  const btnReset = document.getElementById('btn-reset');
  const toastEl = document.getElementById('toast');

  // --- HÀM TIỆN ÍCH ---

  function formatCurrency(number) {
    if (!number || isNaN(number)) return '0 ₫';
    return Math.round(number).toLocaleString('vi-VN') + ' ₫';
  }

  function parseCurrencyInput(value) {
    if (!value) return 0;
    const cleanNum = value.toString().replace(/[^\d]/g, '');
    return cleanNum ? parseInt(cleanNum, 10) : 0;
  }

  let toastTimer = null;
  function showToast(message, icon = '✓') {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2400);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Không thể lưu vào localStorage', e);
    }
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        state.members = Array.isArray(parsed.members) ? parsed.members : [];
        state.expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
      }
    } catch (e) {
      console.warn('Lỗi đọc localStorage', e);
    }
  }

  // --- CHUYỂN TAB ---
  function switchTab(targetTab) {
    state.activeTab = targetTab;
    tabs.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === targetTab);
    });
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-${targetTab}`);
    });

    if (targetTab === 'expenses') {
      renderExpenseFormPills();
    } else if (targetTab === 'settlement') {
      calculateAndRenderSettlement();
    }
  }

  tabs.forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      switchTab(tabBtn.dataset.tab);
    });
  });

  btnGotoExpenses.addEventListener('click', () => {
    if (state.members.length < 2) {
      showToast('Nên có ít nhất 2 thành viên để chia tiền!', '⚠️');
    }
    switchTab('expenses');
  });

  // --- QUẢN LÝ THÀNH VIÊN (TAB 1) ---

  function addMember(name) {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Vui lòng nhập tên thành viên', '⚠️');
      return false;
    }
    if (state.members.includes(trimmed)) {
      showToast(`Tên "${trimmed}" đã có trong danh sách!`, '⚠️');
      return false;
    }
    state.members.push(trimmed);
    saveState();
    renderMembers();
    showToast(`Đã thêm ${trimmed}`);
    return true;
  }

  function removeMember(name) {
    // Kiểm tra xem thành viên này đã có trong hóa đơn nào chưa
    const isInExpense = state.expenses.some(exp => 
      exp.paidBy === name || exp.splitBetween.includes(name)
    );

    if (isInExpense) {
      if (!confirm(`"${name}" đã có trong các hóa đơn chi tiêu. Xóa thành viên này sẽ loại bỏ họ khỏi các hóa đơn liên quan. Tiếp tục?`)) {
        return;
      }
      // Xóa thành viên khỏi các hóa đơn
      state.expenses = state.expenses.filter(exp => exp.paidBy !== name).map(exp => {
        return {
          ...exp,
          splitBetween: exp.splitBetween.filter(m => m !== name)
        };
      }).filter(exp => exp.splitBetween.length > 0);
    }

    state.members = state.members.filter(m => m !== name);
    saveState();
    renderMembers();
    renderExpenses();
    showToast(`Đã xóa ${name}`);
  }

  function renderMembers() {
    badgeMembers.textContent = state.members.length;

    if (state.members.length === 0) {
      membersEmpty.style.display = 'block';
      membersChipList.innerHTML = '';
      return;
    }

    membersEmpty.style.display = 'none';
    membersChipList.innerHTML = state.members.map(name => {
      const firstLetter = name.charAt(0).toUpperCase();
      return `
        <div class="member-badge">
          <span class="member-badge-avatar">${firstLetter}</span>
          <span class="member-name">${escapeHtml(name)}</span>
          <button type="button" class="btn-delete-member" data-member="${escapeHtml(name)}" title="Xóa">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    // Gắn sự kiện xóa
    membersChipList.querySelectorAll('.btn-delete-member').forEach(btn => {
      btn.addEventListener('click', () => {
        removeMember(btn.dataset.member);
      });
    });
  }

  formAddMember.addEventListener('submit', (e) => {
    e.preventDefault();
    if (addMember(inputMemberName.value)) {
      inputMemberName.value = '';
      inputMemberName.focus();
    }
  });

  quickNameBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      addMember(name);
    });
  });

  // --- QUẢN LÝ HÓA ĐƠN (TAB 2) ---

  // Xử lý format ô nhập tiền
  inputExpenseAmount.addEventListener('input', (e) => {
    const rawVal = parseCurrencyInput(e.target.value);
    if (rawVal === 0) {
      e.target.value = '';
    } else {
      e.target.value = rawVal.toLocaleString('vi-VN');
    }
    updateSplitPreview();
  });

  // Nút bấm cộng tiền nhanh (+50k, +100k, ...)
  quickAmountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const addVal = parseInt(btn.dataset.add, 10);
      const current = parseCurrencyInput(inputExpenseAmount.value);
      const newVal = current + addVal;
      inputExpenseAmount.value = newVal.toLocaleString('vi-VN');
      updateSplitPreview();
    });
  });

  function renderExpenseFormPills() {
    if (state.members.length === 0) {
      payerSelection.innerHTML = '<p class="helper-text">Chưa có thành viên nào. Hãy thêm ở Tab 1 trước nhé!</p>';
      splitterSelection.innerHTML = '';
      splitPerPersonPreview.innerHTML = '';
      return;
    }

    // Default payer
    if (!formExpenseState.payer || !state.members.includes(formExpenseState.payer)) {
      formExpenseState.payer = state.members[0];
    }

    // Default splitters: all members
    if (formExpenseState.splitters.size === 0) {
      formExpenseState.splitters = new Set(state.members);
    } else {
      // Giữ lại các thành viên còn hợp lệ
      const validSplitters = new Set();
      state.members.forEach(m => {
        if (formExpenseState.splitters.has(m)) validSplitters.add(m);
      });
      formExpenseState.splitters = validSplitters.size > 0 ? validSplitters : new Set(state.members);
    }

    // Render Payer Pills (Radio style)
    payerSelection.innerHTML = state.members.map(member => {
      const isSelected = member === formExpenseState.payer;
      return `
        <button type="button" class="pill-select-btn ${isSelected ? 'selected' : ''}" data-type="payer" data-name="${escapeHtml(member)}">
          ${isSelected ? '✓' : ''} ${escapeHtml(member)}
        </button>
      `;
    }).join('');

    // Render Splitters Pills (Checkbox style)
    splitterSelection.innerHTML = state.members.map(member => {
      const isSelected = formExpenseState.splitters.has(member);
      return `
        <button type="button" class="pill-select-btn ${isSelected ? 'selected' : ''}" data-type="splitter" data-name="${escapeHtml(member)}">
          ${isSelected ? '✓' : '○'} ${escapeHtml(member)}
        </button>
      `;
    }).join('');

    // Gắn sự kiện click cho pill payer
    payerSelection.querySelectorAll('.pill-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        formExpenseState.payer = btn.dataset.name;
        renderExpenseFormPills();
      });
    });

    // Gắn sự kiện click cho pill splitter
    splitterSelection.querySelectorAll('.pill-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        if (formExpenseState.splitters.has(name)) {
          // Phải giữ lại ít nhất 1 người chia
          if (formExpenseState.splitters.size <= 1) {
            showToast('Hóa đơn phải có ít nhất 1 người chia!', '⚠️');
            return;
          }
          formExpenseState.splitters.delete(name);
        } else {
          formExpenseState.splitters.add(name);
        }
        renderExpenseFormPills();
        updateSplitPreview();
      });
    });

    updateSplitPreview();
  }

  // Nút chọn tất cả người chia
  btnToggleAllSplitters.addEventListener('click', () => {
    if (formExpenseState.splitters.size === state.members.length) {
      // Nếu đang chọn hết thì chọn lại chỉ 1 người (người trả)
      formExpenseState.splitters = new Set([formExpenseState.payer || state.members[0]]);
    } else {
      // Chọn tất cả
      formExpenseState.splitters = new Set(state.members);
    }
    renderExpenseFormPills();
    updateSplitPreview();
  });

  function updateSplitPreview() {
    const amount = parseCurrencyInput(inputExpenseAmount.value);
    const count = formExpenseState.splitters.size;
    if (amount > 0 && count > 0) {
      const perPerson = Math.round(amount / count);
      splitPerPersonPreview.innerHTML = `Mỗi người chịu: <strong>${formatCurrency(perPerson)}</strong> (${count} người tham gia)`;
    } else {
      splitPerPersonPreview.innerHTML = `Mỗi người chịu: <strong>0 ₫</strong>`;
    }
  }

  // Thêm hóa đơn mới
  formAddExpense.addEventListener('submit', (e) => {
    e.preventDefault();

    if (state.members.length < 2) {
      showToast('Cần có ít nhất 2 thành viên trước khi thêm hóa đơn!', '⚠️');
      switchTab('members');
      return;
    }

    const title = inputExpenseTitle.value.trim();
    const amount = parseCurrencyInput(inputExpenseAmount.value);
    const payer = formExpenseState.payer;
    const splitBetween = Array.from(formExpenseState.splitters);

    if (!title) {
      showToast('Vui lòng nhập nội dung hóa đơn', '⚠️');
      return;
    }

    if (amount <= 0) {
      showToast('Số tiền phải lớn hơn 0', '⚠️');
      return;
    }

    if (!payer) {
      showToast('Hãy chọn người đã trả tiền', '⚠️');
      return;
    }

    if (splitBetween.length === 0) {
      showToast('Hãy chọn ít nhất 1 người cùng chia', '⚠️');
      return;
    }

    const newExpense = {
      id: Date.now().toString(),
      title,
      amount,
      paidBy: payer,
      splitBetween,
      createdAt: new Date().toLocaleDateString('vi-VN')
    };

    state.expenses.unshift(newExpense);
    saveState();

    // Reset form
    inputExpenseTitle.value = '';
    inputExpenseAmount.value = '';
    updateSplitPreview();

    renderExpenses();
    showToast(`Đã thêm hóa đơn "${title}"`);
  });

  function deleteExpense(id) {
    state.expenses = state.expenses.filter(exp => exp.id !== id);
    saveState();
    renderExpenses();
    showToast('Đã xóa hóa đơn');
  }

  function renderExpenses() {
    badgeExpenses.textContent = state.expenses.length;
    expenseCount.textContent = state.expenses.length;

    let totalGroupSpent = 0;
    state.expenses.forEach(exp => {
      totalGroupSpent += exp.amount;
    });
    totalSpentAmount.textContent = formatCurrency(totalGroupSpent);

    if (state.expenses.length === 0) {
      expensesEmpty.style.display = 'block';
      expensesList.innerHTML = '';
      return;
    }

    expensesEmpty.style.display = 'none';
    expensesList.innerHTML = state.expenses.map(exp => {
      const splitText = exp.splitBetween.length === state.members.length
        ? 'Cả nhóm'
        : `${exp.splitBetween.length} người (${exp.splitBetween.join(', ')})`;

      return `
        <div class="expense-item">
          <div class="expense-info-left">
            <div class="expense-item-title">${escapeHtml(exp.title)}</div>
            <div class="expense-item-meta">
              Người trả: <span class="payer-name">${escapeHtml(exp.paidBy)}</span> • Chia: ${escapeHtml(splitText)}
            </div>
          </div>
          <div class="expense-info-right">
            <div class="expense-item-amount">${formatCurrency(exp.amount)}</div>
            <button type="button" class="btn-delete-expense" data-id="${exp.id}" title="Xóa hóa đơn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    expensesList.querySelectorAll('.btn-delete-expense').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteExpense(btn.dataset.id);
      });
    });
  }

  // --- THUẬT TOÁN TÍNH TOÁN & TẤT TOÁN CÔNG NỢ (TAB 3) ---

  function calculateAndRenderSettlement() {
    const members = state.members;
    summaryMemberCount.textContent = members.length;

    let totalSpent = 0;
    state.expenses.forEach(e => totalSpent += e.amount);
    summaryTotalGroup.textContent = formatCurrency(totalSpent);

    if (members.length < 2 || state.expenses.length === 0) {
      settlementTransactionsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🤝</div>
          <p>Chưa đủ thông tin để tính toán. Hãy thêm thành viên và ít nhất 1 hóa đơn!</p>
        </div>
      `;
      memberBalanceList.innerHTML = '';
      return;
    }

    // 1. Tính số tiền ĐÃ TRẢ (paid) và PHẢI CHỊU (owed) của từng người
    const balanceMap = {};
    members.forEach(m => {
      balanceMap[m] = { paid: 0, share: 0, net: 0 };
    });

    state.expenses.forEach(exp => {
      // Người trả tiền
      if (balanceMap[exp.paidBy]) {
        balanceMap[exp.paidBy].paid += exp.amount;
      }

      // Chia đều cho những người tham gia
      const participants = exp.splitBetween.filter(p => balanceMap[p]);
      if (participants.length > 0) {
        const splitAmount = exp.amount / participants.length;
        participants.forEach(p => {
          balanceMap[p].share += splitAmount;
        });
      }
    });

    // Tính net (Số dư = Đã trả - Phải chịu)
    members.forEach(m => {
      balanceMap[m].net = Math.round(balanceMap[m].paid - balanceMap[m].share);
    });

    // 2. Thuật toán tối giản hóa số giao dịch chuyển tiền (Greedy Debt Settlement)
    const creditors = []; // Người cần nhận lại tiền (net > 0)
    const debtors = [];   // Người cần trả thêm tiền (net < 0)

    members.forEach(m => {
      const net = balanceMap[m].net;
      if (net > 50) { // ngưỡng tránh sai số lẻ nhỏ
        creditors.push({ name: m, amount: net });
      } else if (net < -50) {
        debtors.push({ name: m, amount: Math.abs(net) });
      }
    });

    // Sắp xếp giảm dần theo số tiền
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const transactions = [];
    let cIdx = 0;
    let dIdx = 0;

    while (cIdx < creditors.length && dIdx < debtors.length) {
      const creditor = creditors[cIdx];
      const debtor = debtors[dIdx];

      const settleAmount = Math.min(creditor.amount, debtor.amount);
      if (settleAmount > 0) {
        transactions.push({
          from: debtor.name,
          to: creditor.name,
          amount: settleAmount
        });
      }

      creditor.amount -= settleAmount;
      debtor.amount -= settleAmount;

      if (creditor.amount <= 50) cIdx++;
      if (debtor.amount <= 50) dIdx++;
    }

    // 3. Render danh sách chuyển khoản
    if (transactions.length === 0) {
      settlementTransactionsList.innerHTML = `
        <div class="settlement-card settled-clean">
          <div class="settlement-flow">
            🎉 Mọi người đã hòa tiền, không ai phải chuyển cho ai cả!
          </div>
        </div>
      `;
    } else {
      settlementTransactionsList.innerHTML = transactions.map(t => {
        return `
          <div class="settlement-card">
            <div class="settlement-flow">
              <span class="debtor-tag">${escapeHtml(t.from)}</span>
              <span class="flow-arrow">➔</span>
              <span class="creditor-tag">${escapeHtml(t.to)}</span>
            </div>
            <div class="settlement-amount">${formatCurrency(t.amount)}</div>
          </div>
        `;
      }).join('');
    }

    // 4. Render bảng chi tiết từng thành viên
    memberBalanceList.innerHTML = members.map(m => {
      const b = balanceMap[m];
      const net = b.net;
      let balanceClass = 'zero';
      let statusDesc = 'Đã hòa tiền';
      let netSign = '';

      if (net > 50) {
        balanceClass = 'positive';
        statusDesc = 'Được nhận lại';
        netSign = '+';
      } else if (net < -50) {
        balanceClass = 'negative';
        statusDesc = 'Cần trả thêm';
        netSign = '-';
      }

      return `
        <div class="member-stat-card">
          <div>
            <div class="stat-person-name">${escapeHtml(m)}</div>
            <div class="stat-subinfo">Đã trả: ${formatCurrency(b.paid)} • Phần dùng: ${formatCurrency(b.share)}</div>
          </div>
          <div class="stat-balance ${balanceClass}">
            <div>${netSign}${formatCurrency(Math.abs(net))}</div>
            <div class="balance-status-desc">${statusDesc}</div>
          </div>
        </div>
      `;
    }).join('');

    // Lưu lại kết quả để copy
    window._lastCalculated = {
      totalSpent,
      memberCount: members.length,
      transactions,
      balanceMap,
      members
    };
  }

  // Sao chép báo cáo kết quả gửi Zalo / Messenger
  btnCopySummary.addEventListener('click', () => {
    const calc = window._lastCalculated;
    if (!calc || calc.members.length === 0) {
      showToast('Chưa có dữ liệu để sao chép', '⚠️');
      return;
    }

    let message = `🧾 BẢNG CHIA TIỀN NHÓM\n`;
    message += `💰 Tổng chi: ${formatCurrency(calc.totalSpent)} (${calc.memberCount} người)\n`;
    message += `--------------------------------\n`;
    message += `🤝 KẾ HOẠCH CHUYỂN TIỀN:\n`;

    if (calc.transactions.length === 0) {
      message += `🎉 Cả nhóm đã hòa nhau, không ai cần trả thêm!\n`;
    } else {
      calc.transactions.forEach(t => {
        message += `👉 ${t.from} chuyển ${t.to}: ${formatCurrency(t.amount)}\n`;
      });
    }

    message += `--------------------------------\n`;
    message += `📊 CHI TIẾT TỪNG NGƯỜI:\n`;
    calc.members.forEach(m => {
      const b = calc.balanceMap[m];
      const net = b.net;
      let note = 'Đã hòa';
      if (net > 50) note = `Được nhận lại +${formatCurrency(net)}`;
      else if (net < -50) note = `Cần trả thêm -${formatCurrency(Math.abs(net))}`;
      message += `• ${m}: Đã chi ${formatCurrency(b.paid)} ➔ ${note}\n`;
    });

    message += `--------------------------------\n`;
    message += `(Tạo bởi Ứng dụng Chia Tiền Nhóm)`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(message).then(() => {
        showToast('Đã sao chép! Dán ngay vào Zalo/Messenger', '📋');
      }).catch(() => {
        fallbackCopyText(message);
      });
    } else {
      fallbackCopyText(message);
    }
  });

  function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('Đã sao chép kết quả!', '📋');
    } catch (err) {
      showToast('Không thể tự động chép, vui lòng thử lại', '⚠️');
    }
    document.body.removeChild(textArea);
  }

  // --- DỮ LIỆU MẪU & LÀM MỚI ---

  btnSample.addEventListener('click', () => {
    state.members = ['Nam', 'Mai', 'Bình', 'Linh'];
    state.expenses = [
      {
        id: '1',
        title: 'Ăn tối lẩu nướng',
        amount: 800000,
        paidBy: 'Nam',
        splitBetween: ['Nam', 'Mai', 'Bình', 'Linh'],
        createdAt: 'Hôm nay'
      },
      {
        id: '2',
        title: 'Trà sữa tráng miệng',
        amount: 140000,
        paidBy: 'Mai',
        splitBetween: ['Mai', 'Linh'],
        createdAt: 'Hôm nay'
      },
      {
        id: '3',
        title: 'Tiền Grab xe về',
        amount: 120000,
        paidBy: 'Linh',
        splitBetween: ['Nam', 'Mai', 'Bình', 'Linh'],
        createdAt: 'Hôm nay'
      }
    ];
    saveState();
    renderMembers();
    renderExpenses();
    renderExpenseFormPills();
    switchTab('settlement');
    showToast('Đã nạp dữ liệu mẫu để bạn trải nghiệm thử!', '🚀');
  });

  btnReset.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu và bắt đầu lại từ đầu không?')) {
      state.members = [];
      state.expenses = [];
      saveState();
      renderMembers();
      renderExpenses();
      renderExpenseFormPills();
      switchTab('members');
      showToast('Đã làm mới toàn bộ dữ liệu!', '🔄');
    }
  });

  // Helper XSS filter
  function escapeHtml(string) {
    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return String(string).replace(/[&<>"']/g, s => entityMap[s]);
  }

  // Khởi động
  function init() {
    loadState();
    renderMembers();
    renderExpenses();
    renderExpenseFormPills();
    switchTab('members');
  }

  init();
})();