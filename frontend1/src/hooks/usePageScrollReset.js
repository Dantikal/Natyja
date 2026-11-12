import { useEffect, useLayoutEffect } from "react";

export function resetPageScroll() {
  window.scrollTo({top:0,left:0,behavior:'instant'});
  if(document.scrollingElement)document.scrollingElement.scrollTop=0;
  document.querySelectorAll('.dashboard-content,.module-table-view').forEach(node=>{node.scrollTop=0;});
}
export default function usePageScrollReset(page) {
  useLayoutEffect(() => {
    resetPageScroll();
  }, [page]);

  useEffect(() => {
    const content = document.querySelector(".dashboard-content");
    if (!content) return;
    const previousRestoration=history.scrollRestoration;history.scrollRestoration="manual";
    let frame;
    const resetAfterNavigation = (event) => {
      const navigation = event.target.closest?.(
        ".dashboard-home__quick-card, .memo-folder, .management-document, .admin-user-list-card, .messenger-back, .module-section-card, .module-period-card, .module-document-card, .analysis-section-card__open, .module-back-button, .methodical-subject-card, .methodical-document-open, .saved-table-card, .document-year-archive__folder button, .document-year-archive__files button"
      );
      if (!navigation) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(resetPageScroll);
    };
    content.addEventListener("click", resetAfterNavigation);
    let title=content.querySelector('h1,h2')?.textContent;
    const observer=new MutationObserver(()=>{
      const next=content.querySelector('h1,h2')?.textContent;
      if(next!==title){title=next;cancelAnimationFrame(frame);frame=requestAnimationFrame(resetPageScroll);}
    });
    observer.observe(content,{childList:true,subtree:true});
    return () => { observer.disconnect();history.scrollRestoration=previousRestoration;cancelAnimationFrame(frame); content.removeEventListener("click", resetAfterNavigation); };
  }, []);
}
