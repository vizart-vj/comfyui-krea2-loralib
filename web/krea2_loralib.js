import { app } from "/scripts/app.js";

app.registerExtension({
    name: "krea2.loralib",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "Krea2LoraLib") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);

            const node = this;
            node._loraIndex = null;
            node._myLoras = [];
            node._activeCategory = null;
            node._searchQuery = "";

            const configWidget = node.widgets.find((w) => w.name === "loras_config");
            if (configWidget) {
                configWidget.serialize = false;
                configWidget.inputEl.style.height = "1px";
                configWidget.inputEl.style.minHeight = "1px";
                configWidget.inputEl.style.padding = "0";
                configWidget.inputEl.style.margin = "0";
                configWidget.inputEl.style.border = "none";
                configWidget.inputEl.style.overflow = "hidden";
                configWidget.inputEl.style.opacity = "0";
                configWidget.inputEl.style.pointerEvents = "none";
                configWidget.dy = 0;
                configWidget.computeSize = () => [0, 0];
            }

            function syncConfig() {
                const data = node._myLoras.map((l) => ({
                    filename: l.filename,
                    category: l.category,
                    trigger: l.trigger,
                    strength: l.strength,
                    enabled: l.enabled,
                }));
                if (configWidget) configWidget.value = JSON.stringify(data);
            }

            const container = document.createElement("div");
            container.style.cssText =
                "width:100%;height:100%;display:flex;flex-direction:column;font-family:system-ui,sans-serif;font-size:12px;color:#ddd;background:#16162a;border-radius:6px;overflow:hidden;";

            container.innerHTML = `
                <style>
                    .k2l-main{display:flex;flex-direction:column;flex:1;min-height:260px;}
                    .k2l-topbar{display:flex;border-bottom:1px solid #2a2a4a;flex-shrink:0;}
                    .k2l-topbtn{flex:1;padding:7px 0;cursor:pointer;text-align:center;font-size:11px;font-weight:600;color:#666;background:transparent;border:none;border-bottom:2px solid transparent;transition:all .15s;}
                    .k2l-topbtn:hover{color:#aaa;}
                    .k2l-topbtn.active{color:#b8a9ff;border-bottom-color:#b8a9ff;}
                    .k2l-panel{display:none;flex:1;flex-direction:column;overflow:hidden;}
                    .k2l-panel.active{display:flex;}
                    .k2l-myloras-list{flex:1;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#333 transparent;padding:4px;}
                    .k2l-lora-row{display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:5px;margin-bottom:2px;background:#1c1c36;transition:background .1s;overflow:hidden;}
                    .k2l-lora-row:hover{background:#252548;}
                    .k2l-lora-row.off{opacity:.45;}
                    .k2l-lora-toggle{width:20px;height:20px;border-radius:4px;border:none;cursor:pointer;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;}
                    .k2l-lora-toggle.on{background:#6c5ce7;color:#fff;}
                    .k2l-lora-toggle.off{background:#333;color:#666;}
                    .k2l-lora-thumb{width:28px;height:28px;border-radius:4px;object-fit:cover;flex-shrink:0;background:#111;}
                    .k2l-lora-info{flex:1;min-width:0;}
                    .k2l-lora-name{font-size:11px;font-weight:600;color:#ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
                    .k2l-lora-trigger{font-size:9px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
                    .k2l-lora-str-wrap{display:flex;align-items:center;gap:4px;width:110px;flex-shrink:0;}
                    .k2l-lora-val{font-size:10px;color:#b8a9ff;width:28px;text-align:right;flex-shrink:0;font-variant-numeric:tabular-nums;}
                    .k2l-lora-str{flex:1;overflow:hidden;}
                    .k2l-lora-str input[type=range]{display:block;width:100%;height:16px;cursor:pointer;-webkit-appearance:none;background:transparent;margin:0;padding:0;}
                    .k2l-lora-str input[type=range]::-webkit-slider-runnable-track{height:3px;background:linear-gradient(to right,#6c5ce7 0%,#6c5ce7 var(--val-pct,50%),#555 var(--val-pct,50%),#555 100%);border-radius:2px;}
                    .k2l-lora-str input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #999;margin-top:-5.5px;cursor:pointer;}
                    .k2l-lora-str input[type=range]::-moz-range-track{height:3px;background:#555;border-radius:2px;}
                    .k2l-lora-str input[type=range]::-moz-range-progress{height:3px;background:#6c5ce7;border-radius:2px;}
                    .k2l-lora-str input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #999;cursor:pointer;}
                    .k2l-lora-del{width:20px;height:20px;border:none;border-radius:3px;background:#333;color:#888;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
                    .k2l-lora-del:hover{background:#e74c3c;color:#fff;}
                    .k2l-my-empty{padding:40px 20px;text-align:center;color:#444;font-size:11px;line-height:1.6;}
                    .k2l-my-empty em{color:#6c5ce7;font-style:normal;}
                    .k2l-gallery-head{padding:6px 8px;border-bottom:1px solid #2a2a4a;display:flex;gap:4px;flex-shrink:0;align-items:center;}
                    .k2l-gallery-head input{flex:1;padding:4px 8px;border:1px solid #333;border-radius:5px;background:#111;color:#ddd;font-size:11px;outline:none;}
                    .k2l-gallery-head input:focus{border-color:#6c5ce7;}
                    .k2l-cat-tabs,.k2l-my-cats{display:flex;gap:0;overflow-x:auto;flex-shrink:0;border-bottom:1px solid #2a2a4a;scrollbar-width:none;}
                    .k2l-cat-tabs::-webkit-scrollbar,.k2l-my-cats::-webkit-scrollbar{display:none;}
                    .k2l-cat-tab{padding:4px 8px;cursor:pointer;white-space:nowrap;font-size:10px;color:#555;border-bottom:2px solid transparent;transition:all .12s;}
                    .k2l-cat-tab:hover{color:#999;}
                    .k2l-cat-tab.active{color:#b8a9ff;border-bottom-color:#b8a9ff;font-weight:600;}
                    .k2l-gallery-scroll{flex:1;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#333 transparent;}
                    .k2l-gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:5px;padding:6px;}
                    .k2l-gcard{position:relative;border:1px solid #2a2a4a;border-radius:5px;overflow:hidden;transition:all .12s;background:#14142e;}
                    .k2l-gcard:hover{border-color:#6c5ce7;}
                    .k2l-gcard.has{border-color:#2ecc71;}
                    .k2l-gcard img{width:100%;aspect-ratio:1;object-fit:cover;display:block;}
                    .k2l-gcard-foot{padding:3px 5px;display:flex;align-items:center;gap:3px;}
                    .k2l-gcard-name{flex:1;font-size:9px;font-weight:600;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
                    .k2l-gcard-dl{flex-shrink:0;width:16px;height:16px;border:none;border-radius:3px;cursor:pointer;font-size:8px;display:flex;align-items:center;justify-content:center;transition:all .12s;background:#6c5ce7;color:#fff;line-height:1;padding:0;}
                    .k2l-gcard-dl:hover{background:#5a4bd6;}
                    .k2l-gcard-dl.done{background:#2ecc71;color:#fff;}
                    .k2l-gallery-bar{padding:5px 8px;border-top:1px solid #2a2a4a;display:flex;gap:4px;flex-shrink:0;}
                    .k2l-gallery-bar button{flex:1;padding:3px;border:1px solid #333;border-radius:4px;background:#1c1c36;color:#aaa;font-size:9px;cursor:pointer;transition:all .12s;}
                    .k2l-gallery-bar button:hover{background:#6c5ce7;border-color:#6c5ce7;color:#fff;}
                    .k2l-progress{font-size:9px;color:#888;text-align:center;padding:2px 4px;min-height:14px;flex-shrink:0;}
                    .k2l-progress.busy{color:#f39c12;}
                </style>
                <div class="k2l-main">
                    <div class="k2l-topbar">
                        <button class="k2l-topbtn active" data-tab="myloras" title="Downloaded LoRAs — enable, adjust strength, delete">My Loras</button>
                        <button class="k2l-topbtn" data-tab="gallery" title="Browse and download new styles from HuggingFace">Gallery</button>
                    </div>
                    <div class="k2l-panel active" data-panel="myloras">
                        <div class="k2l-gallery-head">
                            <input class="k2l-my-search" placeholder="Search downloaded..." title="Search downloaded LoRAs by name or trigger" />
                        </div>
                        <div class="k2l-my-cats"></div>
                        <div class="k2l-myloras-list"></div>
                    </div>
                    <div class="k2l-panel" data-panel="gallery">
                        <div class="k2l-gallery-head">
                            <input class="k2l-search" placeholder="Search 1503 styles..." title="Search by style name or trigger phrase" />
                        </div>
                        <div class="k2l-cat-tabs"></div>
                        <div class="k2l-gallery-scroll">
                            <div class="k2l-gallery-grid"></div>
                        </div>
                        <div class="k2l-gallery-bar">
                            <button class="k2l-dl-cat" title="Download all LoRAs in the selected category">Download Category</button>
                        </div>
                    </div>
                    <div class="k2l-progress"></div>
                </div>
            `;

            node.addDOMWidget("gallery", "DIV", container, { serialize: false, hideOnZoom: false });
            node.setSize([node.size[0], 340]);

            const myLorasList = container.querySelector(".k2l-myloras-list");
            const myCatsEl = container.querySelector(".k2l-my-cats");
            const mySearchEl = container.querySelector(".k2l-my-search");
            const galleryGrid = container.querySelector(".k2l-gallery-grid");
            const catTabsEl = container.querySelector(".k2l-cat-tabs");
            const searchEl = container.querySelector(".k2l-search");
            const progressEl = container.querySelector(".k2l-progress");

            let mySearch = "";
            let myActiveCat = null;

            container.querySelectorAll(".k2l-topbtn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    container.querySelectorAll(".k2l-topbtn").forEach((b) => b.classList.remove("active"));
                    container.querySelectorAll(".k2l-panel").forEach((p) => p.classList.remove("active"));
                    btn.classList.add("active");
                    container.querySelector(`[data-panel="${btn.dataset.tab}"]`).classList.add("active");
                    if (btn.dataset.tab === "myloras") renderMyLoras();
                    else renderGallery();
                });
            });

            function renderMyLoras() {
                if (!node._myLoras.length) {
                    myCatsEl.innerHTML = "";
                    myLorasList.innerHTML = `<div class="k2l-my-empty">No downloaded LoRAs yet.<br>Go to <em>Gallery</em> tab to browse and download styles.</div>`;
                    return;
                }

                const catCounts = {};
                for (const l of node._myLoras) {
                    const c = l.category || "Other";
                    catCounts[c] = (catCounts[c] || 0) + 1;
                }
                const cats = Object.keys(catCounts).sort();

                if (!myActiveCat || !catCounts[myActiveCat]) myActiveCat = null;

                myCatsEl.innerHTML = cats
                    .map(
                        (c) =>
                            `<div class="k2l-cat-tab ${myActiveCat === c ? "active" : ""}" data-c="${c}">${c} (${catCounts[c]})</div>`
                    )
                    .join("");

                myCatsEl.querySelectorAll(".k2l-cat-tab").forEach((t) => {
                    t.onclick = () => {
                        myActiveCat = myActiveCat === t.dataset.c ? null : t.dataset.c;
                        renderMyLoras();
                    };
                });

                const q = mySearch.toLowerCase();
                const filtered = node._myLoras.filter((l) => {
                    if (myActiveCat && (l.category || "Other") !== myActiveCat) return false;
                    if (q && !l.name.toLowerCase().includes(q) && !l.trigger.toLowerCase().includes(q)) return false;
                    return true;
                });

                if (!filtered.length) {
                    myLorasList.innerHTML = `<div class="k2l-my-empty">No matches</div>`;
                    return;
                }

                myLorasList.innerHTML = filtered
                    .map(
                        (l) => `
                    <div class="k2l-lora-row ${l.enabled ? "" : "off"}">
                        <button class="k2l-lora-toggle ${l.enabled ? "on" : "off"}" data-fn="${l.filename}" title="Enable / disable this LoRA in the pipeline">${l.enabled ? "✓" : "—"}</button>
                        <img class="k2l-lora-thumb" src="${l.preview || ""}" onerror="this.style.display='none'" />
                        <div class="k2l-lora-info">
                            <div class="k2l-lora-name" title="${l.name} — ${l.trigger}">${l.name}</div>
                            <div class="k2l-lora-trigger" title="Trigger phrase: ${l.trigger}">${l.trigger}</div>
                        </div>
                        <div class="k2l-lora-str-wrap">
                            <span class="k2l-lora-val">${l.strength.toFixed(2)}</span>
                            <div class="k2l-lora-str">
                                <input type="range" min="0" max="3" step="0.05" value="${l.strength}" data-fn="${l.filename}" title="LoRA strength (0 = off, 1 = default, 2+ = strong)" />
                            </div>
                        </div>
                        <button class="k2l-lora-del" data-fn="${l.filename}" data-name="${l.name}" title="Delete LoRA file from disk">✕</button>
                    </div>`
                    )
                    .join("");

                myLorasList.querySelectorAll(".k2l-lora-toggle").forEach((b) => {
                    b.onclick = () => {
                        const l = node._myLoras.find((x) => x.filename === b.dataset.fn);
                        if (l) { l.enabled = !l.enabled; syncConfig(); renderMyLoras(); }
                    };
                });
                function updateSlider(inp) {
                    const v = parseFloat(inp.value);
                    const pct = ((v - 0) / (3 - 0)) * 100;
                    const wrap = inp.closest(".k2l-lora-str-wrap");
                    const val = wrap.querySelector(".k2l-lora-val");
                    wrap.style.setProperty("--val-pct", pct + "%");
                    val.textContent = isNaN(v) ? "1.00" : v.toFixed(2);
                }

                myLorasList.querySelectorAll(".k2l-lora-str input[type=range]").forEach((inp) => {
                    updateSlider(inp);
                    inp.oninput = () => {
                        const l = node._myLoras.find((x) => x.filename === inp.dataset.fn);
                        if (l) {
                            const v = parseFloat(inp.value); l.strength = isNaN(v) ? 1 : v;
                            updateSlider(inp);
                            syncConfig();
                        }
                    };
                });
                myLorasList.querySelectorAll(".k2l-lora-del").forEach((b) => {
                    b.onclick = async () => {
                        const fn = b.dataset.fn;
                        const name = b.dataset.name;
                        if (!confirm(`Delete "${name}" from disk?`)) return;
                        progressEl.textContent = `Deleting ${name}...`;
                        progressEl.classList.add("busy");
                        try {
                            const r = await fetch("/krea2-loralib/delete", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ filename: fn }),
                            });
                            const d = await r.json();
                            if (d.status === "ok") {
                                node._myLoras = node._myLoras.filter((x) => x.filename !== fn);
                                syncConfig();
                                renderMyLoras();
                                renderGallery();
                                progressEl.textContent = `${name} deleted`;
                            } else {
                                progressEl.textContent = `Error: ${d.error || "unknown"}`;
                            }
                        } catch (e) {
                            progressEl.textContent = `Error: ${e.message}`;
                        }
                        progressEl.classList.remove("busy");
                    };
                });
            }

            mySearchEl.oninput = () => { mySearch = mySearchEl.value; renderMyLoras(); };

            function renderGallery() {
                if (!node._loraIndex || !node._activeCategory) {
                    galleryGrid.innerHTML = '<div class="k2l-my-empty">Loading styles...</div>';
                    return;
                }
                const loras = node._loraIndex[node._activeCategory] || [];
                const q = node._searchQuery.toLowerCase();
                const mySet = new Set(node._myLoras.map((l) => l.filename));

                const filtered = q
                    ? loras.filter(
                          (l) =>
                              l.name.toLowerCase().includes(q) ||
                              l.trigger.toLowerCase().includes(q)
                      )
                    : loras;

                if (!filtered.length) {
                    galleryGrid.innerHTML = '<div class="k2l-my-empty">No matches</div>';
                    return;
                }

                galleryGrid.innerHTML = filtered
                    .map(
                        (l) => {
                            const inMy = mySet.has(l.filename);
                            return `
                    <div class="k2l-gcard ${inMy ? "has" : ""}" title="${l.name}\nTrigger: ${l.trigger}">
                        <img src="${l.preview || ""}" loading="lazy" onerror="this.style.opacity=.3" />
                        <div class="k2l-gcard-foot">
                            <div class="k2l-gcard-name">${l.name}</div>
                            <button class="k2l-gcard-dl ${inMy ? "done" : ""}" data-fn="${l.filename}" title="${inMy ? "Already in My Loras" : "Download & add to My Loras"}">${inMy ? "✓" : "⬇"}</button>
                        </div>
                    </div>`;
                        }
                    )
                    .join("");

                galleryGrid.querySelectorAll(".k2l-gcard-dl").forEach((btn) => {
                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        const fn = btn.dataset.fn;
                        if (node._myLoras.find((l) => l.filename === fn)) return;
                        const lora = loras.find((l) => l.filename === fn);
                        if (!lora) return;

                        progressEl.textContent = `Downloading ${lora.name}...`;
                        progressEl.classList.add("busy");
                        try {
                            const r = await fetch("/krea2-loralib/download", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    filename: lora.filename,
                                    comfy_url: lora.comfy_url,
                                    category: node._activeCategory,
                                }),
                            });
                            const d = await r.json();
                            if (d.status === "ok" || d.status === "already_exists") {
                                lora.downloaded = true;
                                node._myLoras.push({
                                    ...lora,
                                    category: node._activeCategory,
                                    strength: 1.0,
                                    enabled: true,
                                });
                                syncConfig();
                                renderMyLoras();
                                renderGallery();
                                progressEl.textContent = `${lora.name} added`;
                            } else {
                                progressEl.textContent = `Error: ${d.error || "unknown"}`;
                            }
                        } catch (e) {
                            progressEl.textContent = `Error: ${e.message}`;
                        }
                        progressEl.classList.remove("busy");
                    };
                });
            }

            async function downloadBatch(entries) {
                progressEl.textContent = `Downloading ${entries.length} LoRAs...`;
                progressEl.classList.add("busy");
                try {
                    const r = await fetch("/krea2-loralib/download-all", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ entries }),
                    });
                    const d = await r.json();
                    const ok = (d.results || []).filter(
                        (x) => x.status === "ok" || x.status === "already_exists"
                    ).length;
                    for (const entry of entries) {
                        const fn = entry.filename;
                        if (!node._myLoras.find((l) => l.filename === fn)) {
                            const lora = findLoraAnywhere(fn);
                            if (lora) {
                                node._myLoras.push({
                                    ...lora,
                                    category: entry.category,
                                    strength: 1.0,
                                    enabled: true,
                                });
                            }
                        }
                    }
                    syncConfig();
                    renderMyLoras();
                    progressEl.textContent = `Downloaded ${ok}/${entries.length}`;
                    progressEl.classList.remove("busy");
                    await loadIndex();
                } catch (e) {
                    progressEl.textContent = `Error: ${e.message}`;
                    progressEl.classList.remove("busy");
                }
            }

            function findLoraAnywhere(filename) {
                if (!node._loraIndex) return null;
                for (const cat of Object.keys(node._loraIndex)) {
                    const lora = node._loraIndex[cat].find((l) => l.filename === filename);
                    if (lora) return { ...lora, category: cat };
                }
                return null;
            }

            async function loadIndex() {
                catTabsEl.innerHTML = "";
                galleryGrid.innerHTML = '<div class="k2l-my-empty">Loading 1503 styles...</div>';
                try {
                    const r = await fetch("/krea2-loralib/index");
                    node._loraIndex = await r.json();
                    const cats = Object.keys(node._loraIndex);

                    const myFns = new Set(node._myLoras.map((l) => l.filename));
                    for (const cat of cats) {
                        for (const lora of node._loraIndex[cat]) {
                            if (lora.downloaded && !myFns.has(lora.filename)) {
                                node._myLoras.push({
                                    ...lora,
                                    category: cat,
                                    strength: 1.0,
                                    enabled: true,
                                });
                                myFns.add(lora.filename);
                            }
                        }
                    }
                    syncConfig();
                    renderMyLoras();

                    catTabsEl.innerHTML = cats
                        .map(
                            (c, i) =>
                                `<div class="k2l-cat-tab ${i === 0 ? "active" : ""}" data-c="${c}">${c} (${node._loraIndex[c].length})</div>`
                        )
                        .join("");

                    catTabsEl.querySelectorAll(".k2l-cat-tab").forEach((t) => {
                        t.onclick = () => {
                            catTabsEl.querySelectorAll(".k2l-cat-tab").forEach((x) => x.classList.remove("active"));
                            t.classList.add("active");
                            node._activeCategory = t.dataset.c;
                            renderGallery();
                        };
                    });

                    if (cats.length) {
                        node._activeCategory = cats[0];
                        renderGallery();
                    }
                } catch (e) {
                    galleryGrid.innerHTML = `<div class="k2l-my-empty">Failed to load: ${e.message}</div>`;
                }
            }

            searchEl.oninput = () => {
                node._searchQuery = searchEl.value;
                renderGallery();
            };

            container.querySelector(".k2l-dl-cat").onclick = () => {
                if (!node._loraIndex || !node._activeCategory) return;
                const loras = node._loraIndex[node._activeCategory] || [];
                const toDl = loras
                    .filter((l) => !l.downloaded && !node._myLoras.find((m) => m.filename === l.filename))
                    .map((l) => ({ filename: l.filename, comfy_url: l.comfy_url, category: node._activeCategory }));
                if (toDl.length) downloadBatch(toDl);
                else progressEl.textContent = "All in category already downloaded";
            };

            if (configWidget && configWidget.value && configWidget.value !== "[]") {
                try {
                    node._myLoras = JSON.parse(configWidget.value);
                } catch (e) {}
            }

            renderMyLoras();
            loadIndex();
        };
    },
});
