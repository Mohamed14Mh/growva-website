(function () {
  const expectedDataFiles = [
    'data/site-settings.json',
    'data/navigation.json',
    'data/pages.json',
    'data/services.json',
    'data/work-projects.json',
    'data/pricing.json',
    'data/faq.json',
    'data/media.json',
    'data/seo.json'
  ];

  const params = new URLSearchParams(window.location.search);
  const debug = params.get('adminDebug') === 'true';
  const pageId = document.body.dataset.pageId || document.querySelector('[data-page-id]')?.dataset.pageId || 'unknown';
  const editableElements = Array.from(document.querySelectorAll('[data-edit-key]'));
  const sections = Array.from(document.querySelectorAll('[data-section-type]'));
  const fields = {};
  const duplicateKeys = [];

  editableElements.forEach(element => {
    const key = element.dataset.editKey;
    if (!key) return;
    if (fields[key]) {
      duplicateKeys.push(key);
      if (Array.isArray(fields[key])) {
        fields[key].push(element);
      } else {
        fields[key] = [fields[key], element];
      }
      return;
    }
    fields[key] = element;
  });

  window.GROWVA_CONTENT_REGISTRY = {
    pageId,
    fields,
    duplicateKeys,
    sections,
    expectedDataFiles,
    get(key) {
      return fields[key] || null;
    },
    keys() {
      return Object.keys(fields);
    }
  };

  if (!debug) return;

  const sectionSummary = sections.map(section => ({
    id: section.dataset.sectionId || '',
    type: section.dataset.sectionType || '',
    order: section.dataset.sectionOrder || ''
  }));

  console.groupCollapsed(`[GROWVA content registry] ${pageId}`);
  console.log('Page ID:', pageId);
  console.log('Editable fields found:', editableElements.length);
  console.log('Duplicate keys:', duplicateKeys.length ? duplicateKeys : 'none');
  console.log('Sections found:', sectionSummary);
  console.log('Current data files expected:', expectedDataFiles);
  console.groupEnd();
})();
