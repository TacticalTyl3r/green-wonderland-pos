// Public, read-only Green Wonderland guide. No PIN or database calls are required.
// Instructions describe the deployed workflows; this module never changes POS data.
const GUIDE_SECTIONS = [
  {
    id: 'first-steps', title: 'Getting Started', icon: '✦',
    description: 'A quick introduction to the register and your employee account.',
    articles: [
      {
        title: 'First-time walkthrough', audience: 'All staff',
        summary: 'Follow this order when starting a shift.',
        steps: [
          'Open the POS Calculator from the left navigation.',
          'Select Login in the header, choose your employee, and enter your assigned employee PIN.',
          'Check your name at the top of the page, then select Clock In when your shift begins.',
          'Build a sample order in the catalog to get comfortable with quantities, product options, and the checkout total.',
          'Complete only real authorized customer sales. Use Clear to discard any practice cart without recording a transaction.'
        ],
        tip: 'The website can be viewed without a PIN, but completing a sale requires an active employee PIN session.'
      },
      {
        title: 'Understand the navigation', audience: 'Everyone',
        summary: 'The left sidebar is the main menu.',
        steps: [
          'POS Calculator opens the product catalog, cart, and checkout.',
          'Dashboard, Employees, Time Management, and Sales & Earnings show features enabled for your role.',
          'Open Admin for authorized management tools such as Bundles & Specials, product settings, permissions, and auditing.',
          'How to Use stays available even when you are signed out. Your accessible menu options depend on permissions.'
        ],
        tip: 'Use the navigation toggle to collapse or expand the sidebar.'
      }
    ]
  },
  {
    id: 'sales-checkout', title: 'Sales & Checkout', icon: '▣',
    description: 'Build orders accurately, apply available offers, and handle receipts.',
    articles: [
      {
        title: 'Create and complete a sale', audience: 'Signed-in employees',
        summary: 'From selecting items to confirming a final checkout.',
        steps: [
          'Choose POS Calculator and browse the categories or search the product name.',
          'Press + ADD on an item. If it has required flavor, strain, or other options, select those before adding it.',
          'Use the + and − buttons in Current Order to adjust quantities.',
          'Choose Pickup or Delivery; when delivering, select the correct delivery zone.',
          'Review the subtotal, automatically applied offers, optional manual discount, loyalty discount, and Total Due.',
          'Verify the customer and amount, then select Complete Checkout and confirm. The POS saves the sale when the server accepts it.',
          'View or copy the generated receipt for the customer.'
        ],
        tip: 'If the status reads MDT Offline or offers have not finished loading, do not assume a checkout will be recorded. Refresh or contact management.'
      },
      {
        title: 'Search, favorites, and product details', audience: 'Everyone',
        summary: 'Find common items faster.',
        steps: [
          'Search products by name or select a category from the catalog.',
          'Select the star on a product to add or remove it from Quick Favorites.',
          'Use Ingredients in the Current Order tabs to review ingredient totals for your selected items.',
          'Favorites and an unfinished cart are stored in the current browser, not in your employee account.'
        ]
      },
      {
        title: 'Find previous receipts', audience: 'Authorized staff',
        summary: 'Look up a completed sale instead of creating a duplicate.',
        steps: [
          'Select History in Current Order or use Sales & Earnings → Sales History if your role allows it.',
          'Filter recorded sales by date, employee, or amount where those controls are provided.',
          'Select a transaction to view its receipt and any recorded offers or loyalty details.',
          'Use authorized refund or void tools instead of editing a historical receipt to reverse a sale.'
        ],
        tip: 'Shared sales history requires an online connection and the relevant history permission.'
      }
    ]
  },
  {
    id: 'offers', title: 'Bundles & Specials', icon: '◈',
    description: 'Know the difference between discounted products and bundled prices.',
    articles: [
      {
        title: 'Sell a bundle or special', audience: 'Signed-in employees',
        summary: 'Use advertised deals without manually guessing the price.',
        steps: [
          'Open POS Calculator and switch from Products to Bundles & Deals.',
          'Browse or search current offers, then select a suitable bundle or eligible special.',
          'For bundles, choose any required flavor or strain for every included product and add the bundle to the order.',
          'For specials, choose the eligible catalog product and add it to the cart.',
          'Confirm the offer savings displayed in Current Order before completing checkout.'
        ],
        tip: 'Different fixed-price bundles should be checked out separately to preserve the intended deal price.'
      },
      {
        title: 'Create or edit an offer', audience: 'Staff with Offers permission',
        summary: 'Manage promotions through the Admin menu.',
        steps: [
          'Open Admin → Bundles & Specials and select + New Offer, or edit an existing offer.',
          'Enter an offer name and choose Product Special for a percentage off one catalog product, or Product Bundle for a fixed bundle price.',
          'For a special, select its single discounted catalog product and enter the percentage. That discount applies per unit.',
          'For a bundle, add one or more catalog products, set each quantity, and enter the complete bundle price.',
          'Optionally add start and end dates, set Offer active, and save your changes.',
          'Return to the list to use search and status filters for live, scheduled, expired, or inactive offers.'
        ],
        tip: 'Creating a second discounted product in a single Product Special is not supported. Use a Product Bundle for multiple catalog items.'
      },
      {
        title: 'Add a Custom Item to an offer', audience: 'Staff with Offers permission',
        summary: 'Include a gift bag, promotional extra, or another named inclusion.',
        steps: [
          'Edit or create a special or bundle in Admin → Bundles & Specials.',
          'Select + Add Custom Item, or choose Custom Item from an item dropdown.',
          'Type the exact description and enter the included quantity.',
          'Save the offer and verify the custom inclusion appears in the offer details.'
        ],
        tip: 'Custom items are informational included extras. They are not separately priced POS products and do not create independent receipt item lines. Keep at least one real catalog product in a bundle.'
      }
    ]
  },
  {
    id: 'loyalty', title: 'Loyalty & Rewards', icon: '★',
    description: 'Enroll by Customer CID, redeem points, and review customer history.',
    articles: [
      {
        title: 'Find or enroll a loyalty customer', audience: 'Signed-in employees',
        summary: 'Customer CID is the loyalty member identifier.',
        steps: [
          'On the POS checkout side, locate Customer Rewards.',
          'Enter the customer’s CID and select Find Member.',
          'If no member exists and enrollment is appropriate, enter the CID and choose + Enroll, then provide a customer display name.',
          'Confirm the correct customer and available points before applying a redemption.'
        ],
        tip: 'Always verify the CID with the customer; avoid creating duplicate memberships.'
      },
      {
        title: 'Use points at checkout', audience: 'Signed-in employees',
        summary: 'Points are optional and calculated using current store reward settings.',
        steps: [
          'Look up the loyalty member in Customer Rewards.',
          'Enter the number of points to redeem, or choose Use All Points if available.',
          'Review the Loyalty Rewards deduction in Current Order and confirm the final Total Due.',
          'Complete checkout; the POS records the authorized redemption and applicable points earned.'
        ],
        tip: 'The points-to-dollar value and earning rules are configurable. Catalog rewards are a separate redemption action and do not automatically reduce the sale total.'
      },
      {
        title: 'Manage loyalty and the rewards catalog', audience: 'Authorized management',
        summary: 'Review balances, adjust points, and configure rules.',
        steps: [
          'Open Sales & Earnings → Loyalty & Rewards if your role has access.',
          'Search customers by CID or name and open a member profile to review activity.',
          'Where authorized, adjust points with a required reason so the change has an audit trail.',
          'Boss-only reward settings can change earning, redemption values, and available catalog rewards.'
        ]
      }
    ]
  },
  {
    id: 'employees', title: 'Employee Tools', icon: '◷',
    description: 'PIN login, shifts, roster information, and time corrections.',
    articles: [
      {
        title: 'Clock in, clock out, and sign out', audience: 'Employees',
        summary: 'Keep your work hours recorded correctly.',
        steps: [
          'Select Login at the top of the site and enter your employee PIN.',
          'Select Clock In when you start working and verify the header reads Clocked In.',
          'Select Clock Out when your shift ends and confirm the header updates.',
          'Use Login → Sign out when you are finished with the website, especially on a shared computer.'
        ],
        tip: 'This Week in the header displays tracked hours. The reporting week resets on Monday at 00:00 UTC.'
      },
      {
        title: 'Employee roster and management', audience: 'Authorized staff',
        summary: 'Manage employees through their profile rather than bypassing the system.',
        steps: [
          'Open Employees if that menu is available to your account.',
          'Browse the roster by role and select an employee to see their profile and employment history.',
          'Use authorized controls to update the employee, change status, or record recognition and notes.',
          'For time corrections, use Time Management and provide the reason required by the adjustment form.'
        ],
        tip: 'Managers and other roles only see tools explicitly permitted for their role. Boss controls permission assignments.'
      }
    ]
  },
  {
    id: 'management', title: 'Management & Settings', icon: '⚙',
    description: 'Product management, reporting, store branding, and permissions.',
    articles: [
      {
        title: 'Update products and product photos', audience: 'Boss / authorized admins',
        summary: 'Keep the shared catalog accurate.',
        steps: [
          'Sign in using a Boss employee PIN to access the store catalog administration tools.',
          'Open Admin → Products, Images & Settings.',
          'Search for an existing product or create a new one, then update its name, category, price, options, ingredients, and active state as needed.',
          'Add a supported image URL in the product image field and save the product.',
          'Return to POS Calculator to confirm the product and any updated picture display correctly.'
        ],
        tip: 'Changes to product prices affect new orders. Double-check entries before saving.'
      },
      {
        title: 'Customize appearance and branding', audience: 'Boss / authorized admins',
        summary: 'Choose a theme and control your store images.',
        steps: [
          'Use the Settings & Appearance control to choose a light, dark, or Green Wonderland color theme.',
          'Review the preview, apply your preferred appearance, and check contrast throughout the POS.',
          'Boss-authorized staff can open Admin → Branding & Images to update supported branding slots, including the browser tab icon.',
          'Refresh the site after changing a browser icon if an older favicon remains cached.'
        ],
        tip: 'Personal appearance preferences are saved in this browser. Store branding may be shared.'
      },
      {
        title: 'Review reports, adjustments, and audits', audience: 'Authorized management',
        summary: 'Understand sales activity and investigate changes.',
        steps: [
          'Open Sales & Earnings and choose Sales History, Financial Reports, Sales Analytics, Product Analytics, or Leaderboards as allowed.',
          'Use filters to find the date, employee, or sale that needs review.',
          'For a refund or void, open the authorized Refunds & Voids tool and supply a reason.',
          'Use Admin → Full Audit Log for recorded staff and administration activity.',
          'Boss tools also include the Export & Backup Center, Security Center, and Roles & Permissions.'
        ],
        tip: 'Reports reflect recorded transactions and the data your role is authorized to access.'
      }
    ]
  },
  {
    id: 'troubleshooting', title: 'Troubleshooting', icon: '?',
    description: 'Common issues and what to check before changing anything.',
    articles: [
      {
        title: 'The POS says MDT Offline or Connecting', audience: 'Everyone',
        summary: 'Check connectivity before handling transactions.',
        steps: [
          'Wait for the header to show MDT Online before completing an order.',
          'Check your connection, then refresh the webpage once.',
          'If the site remains offline, report the status and any displayed error to management.',
          'Do not rely on example or cached product data for a real sale when server checkout is unavailable.'
        ]
      },
      {
        title: 'My PIN or page access does not work', audience: 'Employees',
        summary: 'Authentication and permissions are separate checks.',
        steps: [
          'Confirm you selected the correct employee account and entered your assigned PIN.',
          'If you have been locked out or the PIN still fails, contact management to review the account or reset access.',
          'If a page is missing from the sidebar, ask a Boss to review your assigned role permissions.',
          'Do not share your PIN or reuse someone else’s account.'
        ]
      },
      {
        title: 'An offer, picture, or receipt is missing', audience: 'Employees',
        summary: 'Refresh and verify the relevant source of truth.',
        steps: [
          'For an offer, verify it is active and within its scheduled dates; refresh Bundles & Deals.',
          'For a product picture, confirm the saved image is reachable and the catalog has refreshed.',
          'For a receipt, search shared Sales History and verify the employee session has permission.',
          'If needed, use Ctrl + Shift + R on desktop to reload current website assets and report persistent problems.'
        ],
        tip: 'Refreshing cannot retroactively complete a failed checkout. Verify the sale in history before attempting it again.'
      }
    ]
  }
];

function elt(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

export function renderHelpGuide(host, {navigate} = {}) {
  host.replaceChildren();
  const page = elt('div', 'gw-help');
  const hero = elt('div', 'gw-help-hero');
  const heroCopy = elt('div', 'gw-help-hero-copy');
  heroCopy.append(
    elt('span', 'gw-help-eyebrow', 'GREEN WONDERLAND  /  EMPLOYEE HANDBOOK'),
    elt('h1', '', 'How to Use Green Wonderland'),
    elt('p', '', 'Everything you need to use the register confidently, manage offers, support loyalty customers, and find the right management tools.')
  );
  const heroAction = elt('button', 'primary', 'Open POS Calculator');
  heroAction.type = 'button';
  heroAction.addEventListener('click', () => navigate?.('pos'));
  hero.append(heroCopy, heroAction);
  const toolbar = elt('div', 'gw-help-toolbar');
  const searchLabel = elt('label', 'gw-help-search');
  searchLabel.append(elt('span', '', 'Search the guide'));
  const search = elt('input');
  search.type = 'search';
  search.placeholder = 'Search checkout, PIN, bundles, receipts…';
  search.autocomplete = 'off';
  search.setAttribute('aria-label', 'Search help topics');
  searchLabel.append(search);
  const clear = elt('button', 'outline', 'Clear');
  clear.type = 'button';
  clear.addEventListener('click', () => { search.value = ''; filterTopics(); search.focus(); });
  const expand = elt('button', 'outline', 'Expand all');
  expand.type = 'button';
  const collapse = elt('button', 'outline', 'Collapse all');
  collapse.type = 'button';
  toolbar.append(searchLabel, clear, expand, collapse);
  const count = elt('p', 'gw-help-results');
  count.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');
  const layout = elt('div', 'gw-help-layout');
  const toc = elt('nav', 'gw-help-toc');
  toc.setAttribute('aria-label', 'Guide sections');
  toc.append(elt('strong', '', 'GUIDE CONTENTS'));
  const contents = elt('div', 'gw-help-toc-links');
  toc.append(contents);
  const body = elt('div', 'gw-help-body');
  const sectionNodes = [];
  const articleNodes = [];
  for (const section of GUIDE_SECTIONS) {
    const sectionEl = elt('section', 'gw-help-section');
    sectionEl.id = 'gw-help-' + section.id;
    const heading = elt('header', 'gw-help-section-header');
    heading.append(
      elt('span', 'gw-help-section-icon', section.icon),
      elt('div', '', '')
    );
    heading.lastChild.append(elt('h2', '', section.title), elt('p', '', section.description));
    const cards = elt('div', 'gw-help-cards');
    const link = elt('button', 'gw-help-toc-link');
    link.type = 'button';
    link.append(elt('span', '', section.icon), elt('span', '', section.title));
    link.addEventListener('click', () => {
      search.value = '';
      filterTopics();
      sectionEl.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
    });
    contents.append(link);
    for (const article of section.articles) {
      const details = elt('details', 'gw-help-card');
      const summary = elt('summary', 'gw-help-card-summary');
      const identity = elt('div', 'gw-help-card-identity');
      identity.append(elt('h3', '', article.title), elt('p', '', article.summary));
      summary.append(identity, elt('span', 'gw-help-chip', article.audience), elt('span', 'gw-help-chevron', '⌄'));
      const description = elt('div', 'gw-help-card-body');
      const steps = elt('ol', 'gw-help-steps');
      for (const step of article.steps) steps.append(elt('li', '', step));
      description.append(steps);
      if (article.tip) {
        const tip = elt('p', 'gw-help-tip');
        tip.append(elt('strong', '', 'GOOD TO KNOW  '), document.createTextNode(article.tip));
        description.append(tip);
      }
      details.append(summary, description);
      cards.append(details);
      articleNodes.push({node: details, sectionEl, searchText: (article.title + ' ' + article.summary + ' ' + article.audience + ' ' + article.steps.join(' ') + ' ' + (article.tip || '') + ' ' + section.title).toLocaleLowerCase()});
    }
    sectionEl.append(heading, cards);
    body.append(sectionEl);
    sectionNodes.push({node: sectionEl, button: link});
  }
  layout.append(toc, body);
  const footer = elt('p', 'gw-help-footer', 'This guide explains the current website. Visible pages, permission levels, and configured rewards can vary by employee role. Never share an employee PIN.');
  page.append(hero, toolbar, count, layout, footer);
  host.append(page);
  function filterTopics() {
    const query = search.value.trim().toLocaleLowerCase();
    let matches = 0;
    for (const article of articleNodes) {
      const visible = !query || article.searchText.includes(query);
      article.node.hidden = !visible;
      if (visible) matches++;
      if (query && visible) article.node.open = true;
    }
    for (const section of sectionNodes) {
      const visible = articleNodes.some(article => article.sectionEl === section.node && !article.node.hidden);
      section.node.hidden = !visible;
      section.button.hidden = !visible;
    }
    count.textContent = query ? matches + ' matching topic' + (matches === 1 ? '' : 's') : articleNodes.length + ' topics across ' + GUIDE_SECTIONS.length + ' sections';
    if (!matches) {
      count.textContent += ' — Try a different search or select Clear.';
    }
  }
  search.addEventListener('input', filterTopics);
  expand.addEventListener('click', () => { for (const article of articleNodes) if (!article.node.hidden) article.node.open = true; });
  collapse.addEventListener('click', () => { for (const article of articleNodes) article.node.open = false; });
  filterTopics();
}
