async function fetchHtml(path) {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(
            `Không thể tải ${path}: ${response.status}`
        );
    }

    return response.text();
}

function fixRelativePaths(root) {
    const isSubPage = window.location.pathname.includes("/pages/") || window.location.href.includes("/pages/");

    root.querySelectorAll("a, img, source, video").forEach(el => {
        if (el.getAttribute("href")) {
            let href = el.getAttribute("href");
            if (isSubPage) {
                if (href.startsWith("../../")) {
                    el.setAttribute("href", href.replace("../../", "../"));
                } else if (href.startsWith("./pages/")) {
                    el.setAttribute("href", href.replace("./pages/", "./"));
                } else if (href.startsWith("./index.html")) {
                    el.setAttribute("href", "../index.html");
                }
            } else {
                if (href.startsWith("../../")) {
                    el.setAttribute("href", href.replace("../../", "./"));
                }
            }
        }
        if (el.getAttribute("src")) {
            let src = el.getAttribute("src");
            if (isSubPage && src.startsWith("./assets/")) {
                el.setAttribute("src", src.replace("./assets/", "../assets/"));
            } else if (!isSubPage && src.startsWith("../../assets/")) {
                el.setAttribute("src", src.replace("../../assets/", "./assets/"));
            }
        }
        if (el.tagName === "VIDEO") {
            el.querySelectorAll("source").forEach(source => {
                let src = source.getAttribute("src");
                if (src) {
                    if (isSubPage && src.startsWith("./assets/")) {
                        source.setAttribute("src", src.replace("./assets/", "../assets/"));
                    } else if (!isSubPage && src.startsWith("../../assets/")) {
                        source.setAttribute("src", src.replace("../../assets/", "./assets/"));
                    }
                }
            });
            el.load();
        }
    });
}

async function loadComponents(root = document) {
    const componentElements = [
        ...root.querySelectorAll("[data-component]")
    ];

    await Promise.all(
        componentElements.map(async element => {
            const path = element.dataset.component;

            if (!path) {
                return;
            }

            try {
                let html = await fetchHtml(path);

                const isSubpage = window.location.pathname.includes('/pages/') || window.location.href.includes('/pages/');
                const doubleDotsPattern = new RegExp('("|\')' + '\\.\\./\\.\\./', 'g');

                if (isSubpage) {
                    html = html.replace(doubleDotsPattern, '$1../');
                } else {
                    html = html.replace(doubleDotsPattern, '$1./');
                }

                element.innerHTML = html;
                element.removeAttribute("data-component");

                fixRelativePaths(element);

                await loadComponents(element);
            } catch (error) {
                console.error(error);

                element.innerHTML = `
                    <div class="component-error">
                        Không thể tải component.
                    </div>
                `;
            }
        })
    );
}

function getPagePathFromUrl() {
    const searchParams = new URLSearchParams(window.location.search);
    const pageParam = searchParams.get("page");

    if (pageParam && pageParam !== "home") {
        return `./pages/${pageParam}.html`;
    }

    const hash = window.location.hash.replace("#", "");
    if (hash && hash !== "home" && hash !== "top" && !hash.startsWith("archive") && !hash.startsWith("about")) {
        return `./pages/${hash}.html`;
    }

    return null;
}

async function executeScripts(container) {
    container.querySelectorAll("script").forEach(oldScript => {
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
}

async function navigateToPage(pagePath) {
    if (typeof closeSidebar === "function") {
        closeSidebar();
    }
    const mainContent = document.querySelector("#main-content") || document.querySelector("#page-content");
    if (!mainContent) return;

    if (!pagePath) {
        // Return to home page: reload components in mainContent
        document.body.className = "home-page";
        await loadComponents(mainContent);
        document.dispatchEvent(new CustomEvent("homePageLoaded"));
        document.dispatchEvent(new CustomEvent("componentsLoaded"));
        return;
    }

    try {
        const pageHtml = await fetchHtml(pagePath);
        mainContent.innerHTML = pageHtml;
        await executeScripts(mainContent);

        window.scrollTo({ top: 0, behavior: "smooth" });

        // 1. Resolve inner components
        await loadComponents(mainContent);

        // 2. Set body class and dispatch page-specific events
        if (pagePath.includes("programme-detail")) {
            document.body.className = "detail-page";
            document.dispatchEvent(new CustomEvent("programmeDetailLoaded"));
        } else if (pagePath.includes("programme-genre")) {
            document.body.className = "genre-page";
            document.dispatchEvent(new CustomEvent("programmeGenreLoaded"));
        } else if (pagePath.includes("about")) {
            document.body.className = "about-page";
            document.dispatchEvent(new CustomEvent("aboutPageLoaded"));
        } else if (pagePath.includes("news")) {
            document.body.className = "news-page-type";
            document.dispatchEvent(new CustomEvent("newsPageLoaded"));
        } else if (pagePath.includes("archives")) {
            document.body.className = "archives-page-type";
            document.dispatchEvent(new CustomEvent("archivesPageLoaded"));
        } else {
            document.body.className = "home-page";
            document.dispatchEvent(new CustomEvent("homePageLoaded"));
        }
        document.dispatchEvent(new CustomEvent("componentsLoaded"));
    } catch (error) {
        console.error(error);
        mainContent.innerHTML = `
            <div class="page-error" style="padding: 100px 20px; text-align: center; font-family: Georgia, serif;">
                <h2 style="color: #57534f; margin-bottom: 16px;">Không thể tải nội dung trang</h2>
                <p style="color: #777777; margin-bottom: 24px;">Vui lòng kiểm tra lại kết nối hoặc quay về trang chủ.</p>
                <a href="../../index.html" style="display: inline-block; padding: 12px 28px; background: #008b4a; color: #fff; border-radius: 999px; text-decoration: none;">Quay về Trang chủ</a>
            </div>
        `;
    }
}

function setupSpaLinkInterceptors() {
    document.addEventListener("click", event => {
        const link = event.target.closest("a[href]");
        if (!link) return;

        const href = link.getAttribute("href");
        if (
            !href ||
            href.startsWith("#") ||
            href.startsWith("javascript:") ||
            href.startsWith("http:") ||
            href.startsWith("https:") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:")
        ) {
            return;
        }

        if (
            link.getAttribute("target") === "_blank" ||
            link.classList.contains("sidebar__link--external") ||
            href.toLowerCase().endsWith(".pdf")
        ) {
            return;
        }

        let pageName = null;

        if (href.includes("page=")) {
            const match = href.match(/page=([^&]+)/);
            if (match) pageName = match[1];
        } else if (href.includes("pages/")) {
            const match = href.match(/pages\/([^.]+)\.html/);
            if (match) pageName = match[1];
        } else if (href.includes("index.html") || href.includes("home.html")) {
            pageName = "home";
        } else if (href.includes("about.html")) {
            pageName = "about";
        }

        if (pageName) {
            event.preventDefault();

            const targetPage = pageName === "home" ? null : `./pages/${pageName}.html`;

            let spaUrl = pageName === "home" ? "index.html" : `index.html?page=${pageName}`;
            if (href.includes("id=")) {
                const idMatch = href.match(/id=([^&]+)/);
                if (idMatch) spaUrl += `&id=${idMatch[1]}`;
            } else if (href.includes("genre=")) {
                const genreMatch = href.match(/genre=([^&]+)/);
                if (genreMatch) spaUrl += `&genre=${genreMatch[1]}`;
            }

            const sideMenu = document.querySelector("[data-side-menu]");
            const overlay = document.querySelector("[data-menu-overlay]");
            if (sideMenu && sideMenu.classList.contains("is-open")) {
                sideMenu.classList.remove("is-open");
                if (overlay) overlay.classList.remove("is-visible");
                document.body.classList.remove("menu-open");
            }

            if (window.history && window.history.pushState) {
                window.history.pushState(null, "", spaUrl);
            }

            navigateToPage(targetPage);
        }
    });

    window.addEventListener("popstate", () => {
        const pagePath = getPagePathFromUrl();
        navigateToPage(pagePath);
    });
}

async function initShell() {
    await loadComponents(document);

    setupSpaLinkInterceptors();

    const initialPage = getPagePathFromUrl();
    if (initialPage) {
        await navigateToPage(initialPage);
    }
}

document.addEventListener("DOMContentLoaded", initShell);

