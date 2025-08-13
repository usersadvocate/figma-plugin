// Sections Detector Plugin (base)
figma.showUI(__html__, { width: 360, height: 300 });

// Imports from modules
import { getSections, getSelectedSectionId } from './services/sections';
import type { SectionInfo } from './services/sections';

// Types are imported from modules

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'get-sections') {
    const sections = getSections();
    const selectedSectionId = getSelectedSectionId();
    figma.ui.postMessage({ type: 'sections-loaded', sections, selectedSectionId });
  }
  
  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

// Listen for selection changes and notify UI with the current section
figma.on('selectionchange', () => {
  const sectionId = getSelectedSectionId();
  figma.ui.postMessage({ type: 'selection-section', sectionId });
});

// Debounced broadcaster for sections list
let pendingSectionsRefresh = false;
function refreshSectionsDebounced() {
  if (pendingSectionsRefresh) return;
  pendingSectionsRefresh = true;
  setTimeout(() => {
    pendingSectionsRefresh = false;
    const sections = getSections();
    const selectedSectionId = getSelectedSectionId();
    figma.ui.postMessage({ type: 'sections-loaded', sections, selectedSectionId });
  }, 150);
}

// Refresh sections when current page changes
figma.on('currentpagechange', () => {
  refreshSectionsDebounced();
});

// Try to track document changes (create/delete/rename/move of sections)
function attachDocumentChangeListener() {
  const handler = (evt: any) => {
    const changes = (evt as any).documentChanges as ReadonlyArray<any> | undefined;
    if (!changes || changes.length === 0) return;
    for (const ch of changes) {
      const node = ch.node as BaseNode | undefined;
      if (node && node.type === 'SECTION') {
        refreshSectionsDebounced();
        return;
      }
    }
  };

  try {
    const loadAllPagesAsync = (figma as any).loadAllPagesAsync;
    if (typeof loadAllPagesAsync === 'function') {
      loadAllPagesAsync()
        .then(() => {
          try {
            figma.on('documentchange', handler);
          } catch (e) {
            startSectionsPolling();
          }
        })
        .catch(() => {
          startSectionsPolling();
        });
    } else {
      try {
        figma.on('documentchange', handler);
      } catch (e) {
        startSectionsPolling();
      }
    }
  } catch (e) {
    startSectionsPolling();
  }
}

let pollingTimer: number | null = null;
function startSectionsPolling() {
  if (pollingTimer !== null) return;
  pollingTimer = setInterval(() => {
    refreshSectionsDebounced();
  }, 1000) as unknown as number;
}

attachDocumentChangeListener();
