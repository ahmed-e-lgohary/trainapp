const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// HTML Interface for DB Viewer
const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database Viewer Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --border: #475569;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Outfit', sans-serif;
    }

    body {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar */
    .sidebar {
      width: 280px;
      background-color: var(--bg-secondary);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .sidebar-header {
      padding: 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sidebar-header h2 {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(to right, #3b82f6, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .sidebar-header .db-status {
      width: 10px;
      height: 10px;
      background-color: var(--success);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--success);
    }

    .collections-list {
      list-style: none;
      padding: 16px;
      flex-grow: 1;
      overflow-y: auto;
    }

    .collection-item {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s ease;
      background-color: transparent;
      border: 1px solid transparent;
    }

    .collection-item:hover {
      background-color: rgba(59, 130, 246, 0.08);
      border-color: rgba(59, 130, 246, 0.2);
    }

    .collection-item.active {
      background-color: var(--accent);
      color: white;
    }

    .collection-item.active .count-badge {
      background-color: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .collection-name {
      font-weight: 500;
      font-size: 0.95rem;
    }

    .count-badge {
      font-size: 0.75rem;
      background-color: var(--bg-tertiary);
      padding: 2px 8px;
      border-radius: 20px;
      color: var(--text-secondary);
      font-weight: 600;
    }

    /* Main Content */
    .main-content {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background-color: var(--bg-primary);
    }

    .header {
      padding: 24px 32px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: rgba(30, 41, 59, 0.5);
      backdrop-filter: blur(8px);
    }

    .header-info h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .header-info p {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .search-box {
      position: relative;
    }

    .search-input {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      color: var(--text-primary);
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 0.9rem;
      width: 250px;
      transition: all 0.2s ease;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }

    .btn {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      color: var(--text-primary);
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn:hover {
      background-color: var(--bg-tertiary);
      border-color: var(--text-secondary);
    }

    .btn-primary {
      background-color: var(--accent);
      border-color: var(--accent);
    }

    .btn-primary:hover {
      background-color: var(--accent-hover);
      border-color: var(--accent-hover);
    }

    /* Content Pane */
    .content-body {
      flex-grow: 1;
      padding: 32px;
      overflow: auto;
    }

    .welcome-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      color: var(--text-secondary);
    }

    .welcome-container svg {
      width: 80px;
      height: 80px;
      margin-bottom: 24px;
      color: var(--accent);
      opacity: 0.8;
    }

    .welcome-container h3 {
      color: var(--text-primary);
      font-size: 1.5rem;
      margin-bottom: 8px;
    }

    /* Table & Cards */
    .table-container {
      background-color: var(--bg-secondary);
      border-radius: 12px;
      border: 1px solid var(--border);
      overflow: hidden;
      margin-bottom: 24px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;
    }

    .data-table th {
      background-color: rgba(15, 23, 42, 0.4);
      padding: 16px 20px;
      font-weight: 600;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.5px;
    }

    .data-table td {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      color: var(--text-primary);
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .data-table tr:last-child td {
      border-bottom: none;
    }

    .data-table tr:hover {
      background-color: rgba(255, 255, 255, 0.02);
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 6px;
      text-transform: capitalize;
    }

    .badge-user { background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; }
    .badge-admin { background-color: rgba(239, 68, 68, 0.15); color: #f87171; }
    .badge-commissary { background-color: rgba(245, 158, 11, 0.15); color: #fbbf24; }

    /* JSON Viewer Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .modal {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      width: 700px;
      max-width: 90%;
      max-height: 85%;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }

    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title {
      font-weight: 600;
      font-size: 1.1rem;
    }

    .close-modal {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 1.5rem;
      cursor: pointer;
    }

    .close-modal:hover {
      color: var(--text-primary);
    }

    .modal-body {
      padding: 24px;
      overflow: auto;
      background-color: #090d16;
    }

    .json-pre {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.85rem;
      color: #34d399;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    /* Actions */
    .row-actions {
      display: flex;
      gap: 8px;
    }

    .action-icon-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .action-icon-btn:hover {
      color: var(--accent);
      background-color: rgba(59, 130, 246, 0.1);
    }
  </style>
</head>
<body>
  <div id="error-banner" style="display: none; background-color: #ef4444; color: white; padding: 12px 24px; font-weight: 500; font-size: 0.9rem; text-align: center; position: fixed; top: 0; left: 0; right: 0; z-index: 9999;"></div>
  <script>
    window.onerror = function(message, source, lineno, colno, error) {
      const banner = document.getElementById('error-banner');
      banner.style.display = 'block';
      banner.innerText = "Client JS Error: " + message + " (Line " + lineno + ":" + colno + ")";
      return false;
    };
  </script>

  <!-- Sidebar -->
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="db-status"></div>
      <h2>DB Viewer (In-Memory)</h2>
    </div>
    <ul class="collections-list" id="collections-list">
      <li style="color: var(--text-secondary); padding: 20px; text-align: center;">Loading collections...</li>
    </ul>
  </div>

  <!-- Main Content -->
  <div class="main-content">
    <div class="header">
      <div class="header-info">
        <h1 id="current-title">Dashboard</h1>
        <p id="current-sub">Select a collection on the left to browse documents</p>
      </div>
      <div class="header-actions">
        <div class="search-box">
          <input type="text" class="search-input" id="search-bar" placeholder="Search rows..." oninput="filterRows()">
        </div>
        <button class="btn" onclick="refreshData()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18v3"></path></svg>
          Refresh
        </button>
      </div>
    </div>

    <div class="content-body" id="content-pane">
      <!-- Welcome Page -->
      <div class="welcome-container" id="welcome-view">
        <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"></path>
        </svg>
        <h3>Welcome to DB Viewer</h3>
        <p>This is a custom dashboard built to explore your local in-memory database.</p>
        <p style="margin-top: 10px; font-size: 0.85rem;">Currently connected to: <code id="db-uri-display" style="background-color: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; color: #60a5fa;">Loading URI...</code></p>
      </div>

      <!-- Data View -->
      <div id="data-view" style="display: none;">
        <div class="table-container">
          <table class="data-table" id="data-table">
            <thead>
              <tr id="table-headers"></tr>
            </thead>
            <tbody id="table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal -->
  <div class="modal-overlay" id="json-modal">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title" id="modal-doc-title">Document Details</span>
        <button class="close-modal" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <pre class="json-pre" id="json-display"></pre>
      </div>
    </div>
  </div>

  <script>
    let activeCollection = '';
    let collectionsData = {};
    let loadedDocuments = [];

    // Fetch initial collections
    async function loadCollections() {
      try {
        const res = await fetch('/db-viewer/api/collections');
        const data = await res.json();
        
        if (data.success) {
          collectionsData = data.data;
          document.getElementById('db-uri-display').innerText = data.uri || 'Local Server DB';
          
          const listHtml = Object.keys(collectionsData).map(name => {
            const count = collectionsData[name];
            const activeClass = name === activeCollection ? 'active' : '';
            return \`
              <li class="collection-item \${activeClass}" onclick="selectCollection('\${name}')">
                <span class="collection-name">\${name}</span>
                <span class="count-badge">\${count}</span>
              </li>
            \`;
          }).join('');
          
          document.getElementById('collections-list').innerHTML = listHtml;
        }
      } catch (err) {
        console.error("Failed to load collections:", err);
      }
    }

    async function selectCollection(name) {
      activeCollection = name;
      document.getElementById('welcome-view').style.display = 'none';
      document.getElementById('data-view').style.display = 'block';
      
      document.getElementById('current-title').innerText = name.toUpperCase();
      document.getElementById('current-sub').innerText = \`Browsing documents in '\${name}' collection\`;

      // Highlight active in list
      const items = document.querySelectorAll('.collection-item');
      items.forEach(item => {
        const nameSpan = item.querySelector('.collection-name');
        if (nameSpan.innerText === name) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      await fetchCollectionData(name);
    }

    async function fetchCollectionData(name) {
      try {
        document.getElementById('table-body').innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary);">Loading data...</td></tr>';
        
        const res = await fetch(\`/db-viewer/api/collections/\${name}\`);
        const data = await res.json();
        
        if (data.success) {
          loadedDocuments = data.data;
          renderTable(loadedDocuments);
        }
      } catch (err) {
        document.getElementById('table-body').innerHTML = \`<tr><td colspan="10" style="text-align: center; color: var(--danger);">Error: \${err.message}</td></tr>\`;
      }
    }

    function renderTable(documents) {
      if (!documents || documents.length === 0) {
        document.getElementById('table-headers').innerHTML = '<th>No Columns</th>';
        document.getElementById('table-body').innerHTML = '<tr><td style="text-align: center; color: var(--text-secondary);">No documents found</td></tr>';
        return;
      }

      let keys = [];
      let customHeaders = [];
      let renderRow = null;

      if (activeCollection === 'trips') {
        customHeaders = ['_id', 'From', 'To', 'Departure', 'Arrival', 'Price', 'Stops', 'Status'];
        renderRow = (doc, index) => {
          const dep = doc.departureDate ? new Date(doc.departureDate).toLocaleString() : 'N/A';
          const arr = doc.arrivalDate ? new Date(doc.arrivalDate).toLocaleString() : 'N/A';
          const stopsCount = doc.stops ? doc.stops.length : 0;
          const fromName = doc.fromStation && doc.fromStation.name ? doc.fromStation.name : 'N/A';
          const toName = doc.toStation && doc.toStation.name ? doc.toStation.name : 'N/A';
          return \`
            <td>\${doc._id}</td>
            <td style="font-weight: 500; color: #60a5fa;">\${fromName}</td>
            <td style="font-weight: 500; color: #60a5fa;">\${toName}</td>
            <td>\${dep}</td>
            <td>\${arr}</td>
            <td>\${doc.price} EGP</td>
            <td>\${stopsCount} stops</td>
            <td><span class="badge" style="background-color: rgba(59, 130, 246, 0.15); color: #60a5fa;">\${doc.status || 'scheduled'}</span></td>
          \`;
        };
      } else if (activeCollection === 'users') {
        customHeaders = ['_id', 'Name', 'Email', 'Phone', 'Role', 'Verified', 'Active'];
        renderRow = (doc, index) => {
          const roleClass = doc.role === 'admin' ? 'badge-admin' : (doc.role === 'commissary' ? 'badge-commissary' : 'badge-user');
          const verifiedColor = doc.isVerified ? 'var(--success)' : 'var(--danger)';
          const activeColor = doc.isActive ? 'var(--success)' : 'var(--danger)';
          return \`
            <td>\${doc._id}</td>
            <td>\${escapeHtml(doc.name || '')}</td>
            <td>\${escapeHtml(doc.email || '')}</td>
            <td>\${escapeHtml(doc.phone || '')}</td>
            <td><span class="badge \${roleClass}">\${doc.role}</span></td>
            <td><span style="color: \${verifiedColor}; font-weight: 600;">\${doc.isVerified}</span></td>
            <td><span style="color: \${activeColor}; font-weight: 600;">\${doc.isActive}</span></td>
          \`;
        };
      } else if (activeCollection === 'trains') {
        customHeaders = ['_id', 'Number', 'Name', 'Type', 'Total Seats'];
        renderRow = (doc, index) => {
          return \`
            <td>\${doc._id}</td>
            <td>\${doc.number || 'N/A'}</td>
            <td>\${escapeHtml(doc.name || '')}</td>
            <td><span class="badge" style="background-color: rgba(99, 102, 241, 0.15); color: #818cf8; text-transform: uppercase;">\${doc.type || 'N/A'}</span></td>
            <td>\${doc.totalSeats || 0}</td>
          \`;
        };
      } else if (activeCollection === 'seats') {
        customHeaders = ['_id', 'Trip', 'Seat No', 'Type', 'Status', 'Price'];
        renderRow = (doc, index) => {
          const statusColor = doc.status === 'available' ? 'var(--success)' : (doc.status === 'held' ? 'var(--warning)' : 'var(--danger)');
          const tripId = doc.trip && doc.trip._id ? doc.trip._id : (typeof doc.trip === 'string' ? doc.trip : '');
          const tripDisplay = doc.trip && doc.trip.departureDate ? new Date(doc.trip.departureDate).toLocaleDateString() : (tripId ? tripId.slice(-8) + '...' : 'N/A');
          return \`
            <td>\${doc._id}</td>
            <td title="\${tripId}">\${tripDisplay}</td>
            <td>\${doc.seatNumber || 'N/A'}</td>
            <td><span class="badge" style="background-color: rgba(139, 92, 246, 0.15); color: #a78bfa;">\${doc.seatType || 'Standard'}</span></td>
            <td><span style="color: \${statusColor}; font-weight: 600; text-transform: capitalize;">\${doc.status || 'N/A'}</span></td>
            <td>\${doc.price || 0} EGP</td>
          \`;
        };
      } else if (activeCollection === 'stations') {
        customHeaders = ['_id', 'Name', 'Normalized Name'];
        renderRow = (doc, index) => {
          return \`
            <td>\${doc._id}</td>
            <td>\${escapeHtml(doc.name || '')}</td>
            <td>\${escapeHtml(doc.normalizedName || '')}</td>
          \`;
        };
      } else if (activeCollection === 'bookings') {
        customHeaders = ['_id', 'User ID', 'Trip ID', 'Seat ID', 'Status', 'Price'];
        renderRow = (doc, index) => {
          const statusColor = doc.status === 'active' ? 'var(--success)' : 'var(--danger)';
          return \`
            <td>\${doc._id}</td>
            <td title="\${doc.userId}">\${doc.userId ? doc.userId.slice(-8) + '...' : 'N/A'}</td>
            <td title="\${doc.tripId}">\${doc.tripId ? doc.tripId.slice(-8) + '...' : 'N/A'}</td>
            <td title="\${doc.seatId}">\${doc.seatId ? doc.seatId.slice(-8) + '...' : 'N/A'}</td>
            <td><span style="color: \${statusColor}; font-weight: 600; text-transform: capitalize;">\${doc.status || 'N/A'}</span></td>
            <td>\${doc.price || 0} EGP</td>
          \`;
        };
      } else {
        // Dynamic Fallback
        const allKeysSet = new Set(['_id']);
        documents.forEach(doc => {
          Object.keys(doc).forEach(key => {
            if (typeof doc[key] !== 'object' || Array.isArray(doc[key]) || doc[key] === null || key === '_id') {
              allKeysSet.add(key);
            }
          });
        });
        keys = Array.from(allKeysSet).slice(0, 6);
        customHeaders = keys;
        renderRow = (doc, index) => {
          return keys.map(key => {
            let val = doc[key];
            if (val === null || val === undefined) return '<td><span style="color: var(--text-secondary); opacity: 0.5;">null</span></td>';
            if (typeof val === 'object') val = JSON.stringify(val);
            return \`<td>\${escapeHtml(String(val))}</td>\`;
          }).join('');
        };
      }

      // Render headers
      let headersHtml = customHeaders.map(header => \`<th>\${header}</th>\`).join('');
      headersHtml += '<th style="text-align: right;">Actions</th>';
      document.getElementById('table-headers').innerHTML = headersHtml;

      // Render rows
      const rowsHtml = documents.map((doc, index) => {
        const cellsHtml = renderRow(doc, index);
        const actionCell = \`
          <td style="text-align: right;">
            <div class="row-actions" style="justify-content: flex-end;">
              <button class="action-icon-btn" onclick="viewJson(\${index})" title="View Raw JSON" style="font-size: 0.95rem; display: flex; align-items: center; gap: 4px; color: var(--accent);">
                <span>👁️</span> <span style="font-size: 0.85rem; font-weight: 500;">View</span>
              </button>
            </div>
          </td>
        \`;
        return \`<tr>\${cellsHtml}\${actionCell}</tr>\`;
      }).join('');

      document.getElementById('table-body').innerHTML = rowsHtml;
    }

    function escapeHtml(text) {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function viewJson(index) {
      const doc = loadedDocuments[index];
      document.getElementById('modal-doc-title').innerText = \`Document: \${doc._id || 'Raw JSON'}\`;
      document.getElementById('json-display').innerText = JSON.stringify(doc, null, 2);
      document.getElementById('json-modal').style.display = 'flex';
    }

    function closeModal() {
      document.getElementById('json-modal').style.display = 'none';
    }

    function refreshData() {
      loadCollections();
      if (activeCollection) {
        fetchCollectionData(activeCollection);
      }
    }

    function filterRows() {
      const query = document.getElementById('search-bar').value.toLowerCase();
      if (!query) {
        renderTable(loadedDocuments);
        return;
      }

      const filtered = loadedDocuments.filter(doc => {
        return Object.values(doc).some(val => 
          String(val).toLowerCase().includes(query)
        );
      });
      renderTable(filtered);
    }

    // Close modal on click outside
    window.onclick = function(event) {
      const modal = document.getElementById('json-modal');
      if (event.target === modal) {
        closeModal();
      }
    }

    // Initial Load
    loadCollections();
  </script>
</body>
</html>
`;

// Helper to sanitize MongoDB documents for JSON output
function formatDoc(doc) {
  return doc.toObject ? doc.toObject() : doc;
}

// API: Get all collections and their counts
router.get("/api/collections", async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const result = {};
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      result[col.name] = count;
    }
    res.json({
      success: true,
      uri: process.env.MONGO_URI || "mongodb://127.0.0.1:52198/test",
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get all documents from a specific collection
router.get("/api/collections/:name", async (req, res) => {
  try {
    const colName = req.params.name;
    
    // Find mongoose model for this collection
    const modelName = mongoose.modelNames().find(name => 
      mongoose.model(name).collection.name === colName
    );
    
    let documents;
    if (modelName) {
      const model = mongoose.model(modelName);
      let query = model.find({}).limit(100);
      
      if (colName === "trips") {
        query = query
          .populate("fromStation", "name")
          .populate("toStation", "name")
          .populate("train", "name number")
          .populate("stops.station", "name");
      } else if (colName === "seats") {
        query = query.populate("trip", "departureDate");
      } else if (colName === "bookings") {
        query = query
          .populate({ path: "userId", select: "name email" })
          .populate({ path: "tripId", select: "departureDate" })
          .populate({ path: "seatId", select: "seatNumber type" });
      }
      
      const docs = await query.exec();
      documents = docs.map(doc => doc.toObject ? doc.toObject() : doc);
    } else {
      documents = await mongoose.connection.db.collection(colName).find({}).limit(100).toArray();
    }
    
    res.json({
      success: true,
      data: documents
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /db-viewer page
router.get("/", (req, res) => {
  res.send(htmlTemplate);
});

module.exports = router;
