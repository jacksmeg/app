import { useMemo, useState } from "react";
import { formatMoney, statusTone } from "../lib/format";
import { DELIVERY_OPTIONS, useJhims } from "../state/JhimsStore";
import { SectionCard, TonePill } from "./Ui";

export const NotificationsPanel = () => {
  const { state, actions } = useJhims();

  return (
    <SectionCard title="Notifications" eyebrow="Realtime updates">
      <div className="stack-list">
        {state.notifications.length ? state.notifications.map((notification) => (
          <button key={notification.id} className={`notification-card ${notification.read ? "is-read" : ""}`} onClick={() => actions.markNotificationRead(notification.id)}>
            <strong>{notification.title}</strong>
            <p>{notification.body}</p>
            <small>{notification.createdAt}</small>
          </button>
        )) : <p className="empty-text">No notifications yet. Checkout, messages, and order updates will appear here.</p>}
      </div>
    </SectionCard>
  );
};

export const ConversationPanel = () => {
  const { state, actions } = useJhims();
  const [body, setBody] = useState("");

  const selectedConversation = state.conversations.find((conversation) => conversation.id === state.selectedConversationId) ?? state.conversations[0];
  const conversationMessages = useMemo(
    () => state.messages.filter((message) => message.conversationId === selectedConversation?.id),
    [selectedConversation?.id, state.messages],
  );

  return (
    <SectionCard title="Chat" eyebrow="Buyer and seller messaging">
      <div className="chat-layout">
        <div className="chat-sidebar">
          {state.conversations.length ? state.conversations.map((conversation) => (
            <button key={conversation.id} className={`chat-thread ${conversation.id === selectedConversation?.id ? "is-active" : ""}`} onClick={() => actions.selectConversation(conversation.id)}>
              <strong>{conversation.label}</strong>
              <small>{conversation.lastMessageAt}</small>
            </button>
          )) : <p className="empty-text">Start a conversation from a product or order.</p>}
        </div>
        <div className="chat-window">
          <div className="chat-messages">
            {conversationMessages.length ? conversationMessages.map((message) => (
              <div key={message.id} className={`chat-bubble ${message.senderId === state.profile?.id ? "is-own" : ""}`}>
                <p>{message.body}</p>
                <small>{message.createdAt}</small>
              </div>
            )) : <p className="empty-text">No messages in this thread yet.</p>}
          </div>
          <div className="chat-compose">
            <input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Type a message..." />
            <button className="button-primary" onClick={async () => { await actions.sendMessage(body); setBody(""); }}>
              Send
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
};

export const DeliveryFeed = ({ orderId }: { orderId?: string }) => {
  const { state } = useJhims();
  const events = state.deliveryEvents.filter((event) => event.orderId === orderId);
  const order = state.orders.find((entry) => entry.id === orderId);

  return (
    <SectionCard title="Delivery tracking" eyebrow="Logistics">
      {order ? (
        <>
          <div className="order-head">
            <div>
              <strong>{order.id}</strong>
              <p>{formatMoney(order.total + order.deliveryFee)} · {order.deliveryOption}</p>
            </div>
            <TonePill label={order.status} tone={statusTone(order.status)} />
          </div>
          <div className="delivery-feed">
            {events.length ? events.map((event) => (
              <div key={event.id} className="delivery-event">
                <div>
                  <strong>{event.status}</strong>
                  <p>{event.note}</p>
                </div>
                <small>{event.createdAt}</small>
              </div>
            )) : <p className="empty-text">Delivery events will appear as the order moves through fulfilment.</p>}
          </div>
        </>
      ) : <p className="empty-text">Choose an order to inspect its delivery timeline.</p>}
    </SectionCard>
  );
};

export const SellerProductComposer = () => {
  const { state, actions } = useJhims();
  const [file, setFile] = useState<File | null>(null);
  const draft = state.productDraft;

  return (
    <SectionCard title="Product manager" eyebrow="Create and edit listings">
      <div className="auth-form auth-form-grid product-composer">
        <label className="field">
          <span>Product name</span>
          <input value={draft.name} onChange={(event) => actions.setProductDraft({ name: event.target.value })} />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={draft.category} onChange={(event) => actions.setProductDraft({ category: event.target.value as typeof draft.category })}>
            <option value="Electronics">Electronics</option>
            <option value="Fashion">Fashion</option>
            <option value="Home">Home</option>
            <option value="Vehicles">Vehicles</option>
            <option value="Beauty">Beauty</option>
            <option value="Groceries">Groceries</option>
          </select>
        </label>
        <label className="field field-span">
          <span>Description</span>
          <textarea value={draft.description} onChange={(event) => actions.setProductDraft({ description: event.target.value })} rows={4} />
        </label>
        <label className="field">
          <span>Price</span>
          <input value={draft.price} onChange={(event) => actions.setProductDraft({ price: event.target.value })} />
        </label>
        <label className="field">
          <span>Discount price</span>
          <input value={draft.discountPrice} onChange={(event) => actions.setProductDraft({ discountPrice: event.target.value })} />
        </label>
        <label className="field">
          <span>Location</span>
          <input value={draft.location} onChange={(event) => actions.setProductDraft({ location: event.target.value })} />
        </label>
        <label className="field">
          <span>Stock</span>
          <input value={draft.stock} onChange={(event) => actions.setProductDraft({ stock: event.target.value })} />
        </label>
        <label className="field">
          <span>Condition</span>
          <select value={draft.condition} onChange={(event) => actions.setProductDraft({ condition: event.target.value as typeof draft.condition })}>
            <option value="New">New</option>
            <option value="Used">Used</option>
          </select>
        </label>
        <label className="field">
          <span>Listing label</span>
          <input value={draft.artLabel} onChange={(event) => actions.setProductDraft({ artLabel: event.target.value })} />
        </label>
        <label className="field field-span">
          <span>Delivery options</span>
          <div className="delivery-toggle-row">
            {DELIVERY_OPTIONS.filter((option) => option !== "Any").map((option) => (
              <button key={option} className={`button-ghost ${draft.deliveryOptions.includes(option) ? "is-active-filter" : ""}`} onClick={() => actions.toggleProductDraftDelivery(option)}>
                {option}
              </button>
            ))}
          </div>
        </label>
        <label className="field field-span">
          <span>Cover image</span>
          <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <label className="field checkbox-field">
          <input type="checkbox" checked={draft.escrowEligible} onChange={(event) => actions.setProductDraft({ escrowEligible: event.target.checked })} />
          <span>Escrow eligible</span>
        </label>
        <label className="field checkbox-field">
          <input type="checkbox" checked={draft.featured} onChange={(event) => actions.setProductDraft({ featured: event.target.checked })} />
          <span>Featured</span>
        </label>
        <label className="field checkbox-field">
          <input type="checkbox" checked={draft.published} onChange={(event) => actions.setProductDraft({ published: event.target.checked })} />
          <span>Published</span>
        </label>
        <div className="card-actions field-span">
          <button className="button-primary" onClick={() => actions.saveProduct(file)}>
            {draft.id ? "Update product" : "Create product"}
          </button>
          <button className="button-secondary" onClick={() => { actions.resetProductDraft(); setFile(null); }}>
            Reset form
          </button>
        </div>
      </div>
    </SectionCard>
  );
};
