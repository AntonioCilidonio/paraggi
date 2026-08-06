import {
  Apple,
  ArrowDown,
  Check,
  createIcons,
  ExternalLink,
  LocateFixed,
  MapPinOff,
  Menu,
  MessageCircleMore,
  MessagesSquare,
  Plus,
  Radio,
  ShieldCheck,
  Siren,
  Smartphone,
  TimerReset,
} from 'lucide';
import './styles.css';

createIcons({
  icons: {
    Apple,
    ArrowDown,
    Check,
    ExternalLink,
    LocateFixed,
    MapPinOff,
    Menu,
    MessageCircleMore,
    MessagesSquare,
    Plus,
    Radio,
    ShieldCheck,
    Siren,
    Smartphone,
    TimerReset,
  },
  attrs: { 'stroke-width': 1.8 },
});

document.documentElement.classList.add('js');

const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const mobileMenu = document.querySelector('[data-mobile-menu]');

const closeMenu = () => {
  menuButton?.setAttribute('aria-expanded', 'false');
  if (mobileMenu) mobileMenu.hidden = true;
};

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  if (mobileMenu) mobileMenu.hidden = open;
});

mobileMenu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const chatButtons = document.querySelectorAll('[data-chat-state]');
const chatImage = document.querySelector('[data-chat-image]');
const chatNote = document.querySelector('[data-chat-note]');

chatButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const isActive = button.dataset.chatState === 'active';
    chatButtons.forEach((item) => item.classList.toggle('is-active', item === button));
    if (chatImage) {
      chatImage.src = isActive ? '/images/app-chat-attiva.png' : '/images/app-chat-sospesa.png';
      chatImage.alt = isActive ? 'Chat privata attiva in Paraggi' : 'Chat privata sospesa in Paraggi';
    }
    if (chatNote) {
      chatNote.classList.toggle('is-paused', !isActive);
      chatNote.innerHTML = `<span></span> ${isActive ? 'Siete nello stesso raggio' : 'Distanza oltre la soglia'}`;
    }
  });
});

document.querySelectorAll('details').forEach((detail) => {
  detail.addEventListener('toggle', () => {
    if (!detail.open) return;
    document.querySelectorAll('details[open]').forEach((other) => {
      if (other !== detail) other.removeAttribute('open');
    });
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 },
);

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
document.querySelector('[data-year]').textContent = new Date().getFullYear();
