const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  products: {
    list: () => ipcRenderer.invoke('products:list'),
    create: (data) => ipcRenderer.invoke('products:create', data),
    update: (id, data) => ipcRenderer.invoke('products:update', id, data),
    remove: (id) => ipcRenderer.invoke('products:remove', id),
  },
  stock: {
    currentState: () => ipcRenderer.invoke('stock:currentState'),
    listMovements: (filters) => ipcRenderer.invoke('stock:listMovements', filters),
    addMovement: (data) => ipcRenderer.invoke('stock:addMovement', data),
    removeMovement: (id) => ipcRenderer.invoke('stock:removeMovement', id),
  },
  expenses: {
    list: (filters) => ipcRenderer.invoke('expenses:list', filters),
    create: (data) => ipcRenderer.invoke('expenses:create', data),
    update: (id, data) => ipcRenderer.invoke('expenses:update', id, data),
    remove: (id) => ipcRenderer.invoke('expenses:remove', id),
  },
  clients: {
    list: () => ipcRenderer.invoke('clients:list'),
    create: (data) => ipcRenderer.invoke('clients:create', data),
    update: (id, data) => ipcRenderer.invoke('clients:update', id, data),
    remove: (id) => ipcRenderer.invoke('clients:remove', id),
  },
  debts: {
    list: (filters) => ipcRenderer.invoke('debts:list', filters),
    get: (id) => ipcRenderer.invoke('debts:get', id),
    create: (data) => ipcRenderer.invoke('debts:create', data),
    remove: (id) => ipcRenderer.invoke('debts:remove', id),
    addPayment: (data) => ipcRenderer.invoke('debts:addPayment', data),
    listPayments: (debtId) => ipcRenderer.invoke('debts:listPayments', debtId),
  },
  dashboard: {
    summary: (filters) => ipcRenderer.invoke('dashboard:summary', filters),
    salesByDay: (filters) => ipcRenderer.invoke('dashboard:salesByDay', filters),
  },
  importExcel: () => ipcRenderer.invoke('import:excel'),
  exportExcel: (filters) => ipcRenderer.invoke('export:excel', filters),
  exportPdf: (filters) => ipcRenderer.invoke('export:pdf', filters),
});
