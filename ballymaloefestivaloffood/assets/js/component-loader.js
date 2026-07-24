async function loadComponent(element) {
  const path = element.dataset.component;

  if (!path) {
    return;
  }

  try {
    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(`Không thể tải component: ${path}`);
    }

    let htmlText = await response.text();

    const hasBaseTag = !!document.querySelector("base");
    const isSubpage = !hasBaseTag && (window.location.pathname.includes('/pages/') ||
      window.location.pathname.split('/').includes('pages'));

    const basePrefix = isSubpage ? "../" : "./";

    // Chuẩn hóa đường dẫn tương đối ../../ trong component thành đường dẫn phù hợp với trang
    htmlText = htmlText.replace(/(href|src)="\.\.\/\.\.\//g, '$1="' + basePrefix);

    element.outerHTML = htmlText;
  } catch (error) {
    console.error(error);
    element.innerHTML = `
      <p style="padding:16px;background:#fee;color:#900">
        ${error.message}
      </p>
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
