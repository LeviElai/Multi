/** A presentation lease, not authentication or gameplay state. */
const sessions = new WeakMap<Document, { count: number; overflow: string; active: string | null }>();
export function acquireGameViewport(doc: Document) {
    let session = sessions.get(doc);
    if (!session) {
        session = { count: 0, overflow: doc.body.style.overflow, active: doc.body.getAttribute('data-game-active') };
        sessions.set(doc, session);
        doc.body.style.overflow = 'hidden';
        doc.body.setAttribute('data-game-active', 'true');
    }
    session.count++;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        if (--session.count > 0) return;
        doc.body.style.overflow = session.overflow;
        if (session.active === null) doc.body.removeAttribute('data-game-active');
        else doc.body.setAttribute('data-game-active', session.active);
        doc.documentElement.style.removeProperty('--game-height');
        doc.documentElement.style.removeProperty('--game-top');
        sessions.delete(doc);
    };
}
