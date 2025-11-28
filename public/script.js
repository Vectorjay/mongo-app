console.log('🔧 script.js loaded successfully!');

class ItemManager {
    constructor() {
        console.log('🔄 ItemManager initialized');
        this.currentEditingId = null;
        this.init();
    }

    init() {
        console.log('🔧 Setting up event listeners');
        this.setupEventListeners();
        this.loadItems();
    }

    setupEventListeners() {
        const form = document.getElementById('itemForm');
        if (!form) {
            console.error('❌ Could not find itemForm element');
            return;
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('📝 Form submitted');
            this.handleSubmit();
        });

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancelEdit();
            });
        }

        console.log('✅ Event listeners set up');
    }

    showLoading(message = 'Loading...') {
        this.hideLoading();

        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay fade-in';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div style="color: white; margin-top: 15px; font-weight: 600;">${message}</div>
        `;
        document.body.appendChild(overlay);
    }

    hideLoading() {
        const existingOverlay = document.querySelector('.loading-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async loadItems() {
        console.log('📋 Loading items from API...');

        try {
            const itemsList = document.getElementById('itemsList');
            if (!itemsList) {
                console.error('❌ Could not find itemsList element');
                return;
            }

            itemsList.innerHTML = '<div class="loading" style="margin: 20px auto;"></div>';

            const response = await fetch('/api/items');
            console.log('📡 API Response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const items = await response.json();
            console.log('✅ Items loaded:', items.length, 'items');
            this.displayItems(items);

        } catch (error) {
            console.error('❌ Error loading items:', error);
            const itemsList = document.getElementById('itemsList');
            if (itemsList) {
                itemsList.innerHTML = `
                    <div class="empty-state fade-in">
                        <h3>Error loading items</h3>
                        <p>${error.message}</p>
                        <button class="btn btn-primary" onclick="itemManager.loadItems()" style="margin-top: 15px;">
                            <span>🔄</span> Try Again
                        </button>
                    </div>
                `;
            }
            this.showToast('Error loading items: ' + error.message, 'error');
        }
    }

    displayItems(items) {
        const itemsList = document.getElementById('itemsList');

        if (!itemsList) {
            console.error('❌ Could not find itemsList element');
            return;
        }

        if (items.length === 0) {
            itemsList.innerHTML = `
                <div class="empty-state fade-in">
                    <h3>No items found</h3>
                    <p>Add your first item to get started!</p>
                </div>
            `;
            return;
        }

        itemsList.innerHTML = `
            <div class="items-grid">
                ${items.map((item, index) => `
                    <div class="item-card fade-in" style="animation-delay: ${index * 0.1}s">
                        <div class="item-header">
                            <span class="item-name">${this.escapeHtml(item.name)}</span>
                            <span class="item-quantity">Qty: ${item.quantity}</span>
                        </div>
                        <p class="item-description">${this.escapeHtml(item.description)}</p>
                        <div class="item-actions">
                            <button class="btn btn-success" onclick="itemManager.editItem('${item._id}')">
                                <span>✏️</span> Edit
                            </button>
                            <button class="btn btn-danger" onclick="itemManager.deleteItem('${item._id}')">
                                <span>🗑️</span> Delete
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async handleSubmit() {
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<span class="loading"></span> Saving...';
        submitBtn.disabled = true;

        const formData = {
            name: document.getElementById('name').value,
            description: document.getElementById('description').value,
            quantity: document.getElementById('quantity').value
        };

        console.log('📤 Submitting form data:', formData);

        try {
            let response;
            const url = this.currentEditingId ? `/api/items/${this.currentEditingId}` : '/api/items';
            const method = this.currentEditingId ? 'PUT' : 'POST';

            console.log(`📡 Making ${method} request to: ${url}`);

            response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Server response:', result);

            this.resetForm();
            await this.loadItems();
            this.showToast(
                this.currentEditingId ? 'Item updated successfully!' : 'Item added successfully!',
                'success'
            );

        } catch (error) {
            console.error('❌ Error saving item:', error);
            this.showToast('Error saving item: ' + error.message, 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async editItem(id) {
        console.log('✏️ Editing item:', id);
        this.showLoading('Loading item...');

        try {
            const response = await fetch(`/api/items/${id}`);
            console.log('📡 Edit response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const item = await response.json();
            console.log('✅ Item loaded for editing:', item);

            document.getElementById('itemId').value = item._id;
            document.getElementById('name').value = item.name;
            document.getElementById('description').value = item.description;
            document.getElementById('quantity').value = item.quantity;

            document.getElementById('form-title').textContent = 'Edit Item';
            document.getElementById('submitBtn').innerHTML = '<span>💾</span> Update Item';
            document.getElementById('cancelBtn').style.display = 'inline-block';

            this.currentEditingId = id;

            document.querySelector('.form-section').scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });

            this.hideLoading();

        } catch (error) {
            console.error('❌ Error loading item for edit:', error);
            this.hideLoading();
            this.showToast('Error loading item: ' + error.message, 'error');
            this.loadItems();
        }
    }

    cancelEdit() {
        console.log('🚫 Edit cancelled');
        this.resetForm();
        this.showToast('Edit cancelled', 'info');
    }

    resetForm() {
        document.getElementById('itemForm').reset();
        document.getElementById('itemId').value = '';
        document.getElementById('form-title').textContent = 'Add New Item';
        document.getElementById('submitBtn').innerHTML = '<span>➕</span> Add Item';
        document.getElementById('cancelBtn').style.display = 'none';
        this.currentEditingId = null;
        console.log('🔄 Form reset');
    }

    async deleteItem(id) {
        console.log('🗑️ Deleting item:', id);

        if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            return;
        }

        this.showLoading('Deleting item...');

        try {
            const response = await fetch(`/api/items/${id}`, {
                method: 'DELETE'
            });

            console.log('📡 Delete response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            await this.loadItems();
            this.showToast('Item deleted successfully!', 'success');

        } catch (error) {
            console.error('❌ Error deleting item:', error);
            this.showToast('Error deleting item: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

console.log('🚀 Starting ItemManager...');
const itemManager = new ItemManager();
console.log('✅ ItemManager started successfully');