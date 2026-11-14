const search = document.querySelector('#blog-search')
if (search && window.PagefindUI) {
    new window.PagefindUI({
        element: '#blog-search',
        baseUrl: new URL('../', location.href).pathname,
        showImages: false,
        translations: { placeholder: '글 검색' },
    })
}
