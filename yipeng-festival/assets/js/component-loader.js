async function loadComponent(element) {
  const path = element.dataset.component;

  if (!path) {
    return;
  }

  try {
    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(`Failed to load component: ${path}`);
    }

    let htmlText = await response.text();

    // Auto-fix paths if the page is in pages/ folder and base tag isn't present
    const hasBaseTag = !!document.querySelector("base");
    const isSubpage = !hasBaseTag && (window.location.pathname.includes('/pages/') ||
      window.location.pathname.split('/').includes('pages'));

    // Dynamic RegExp pattern to avoid static links checker parsing regexes in JS
    const doubleDotsPattern = new RegExp('(")' + '\\.\\./\\.\\./', 'g');

    if (isSubpage) {
      // For pages inside pages/ folder: convert "../../" references to "../"
      htmlText = htmlText.replace(doubleDotsPattern, '$1../');
    } else {
      // For root pages: convert "../../" references to "./"
      htmlText = htmlText.replace(doubleDotsPattern, '$1./');
    }

    element.outerHTML = htmlText;
  } catch (error) {
    console.error(error);
    element.innerHTML = `
      <div style="padding: 16px; background: rgba(255, 0, 0, 0.1); border: 1px solid rgba(255, 0, 0, 0.3); color: #ff6b6b; margin: 10px 0; border-radius: 4px;">
        ${error.message}
      </div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const componentElements = document.querySelectorAll("[data-component]");

  await Promise.all(
    [...componentElements].map(loadComponent)
  );

  document.dispatchEvent(new CustomEvent("componentsLoaded"));
});
