<script lang="ts">
  /**
   * Main Layout
   *
   * Primary application layout with:
   * - Header with navigation
   * - Sidebar (collapsible)
   * - Main content area
   * - Notification area
   */
  import Header from '$lib/components/Header.svelte';
  import Sidebar from '$lib/components/sidebar/Sidebar.svelte';
  import { appStore, sidebarCollapsed, currentRoute, notifications } from '$lib/stores/app.store';

  // Bind sidebar collapsed state to app store
  let collapsed: boolean;
  $: collapsed = $sidebarCollapsed;

  function handleSidebarToggle() {
    appStore.toggleSidebar();
  }

  // Determine if we should show the sidebar based on route
  $: showSidebar = $currentRoute === '/' || $currentRoute === '';
</script>

<div class="layout">
  <Header />

  <nav class="tab-bar">
    <a
      href="#/"
      class="tab"
      class:active={$currentRoute === '/' || $currentRoute === ''}
    >
      CODE
    </a>
    <a
      href="#/simulation"
      class="tab"
      class:active={$currentRoute?.startsWith('/simulation')}
    >
      SIMULATION
    </a>
    <div class="tab-spacer"></div>
    <a
      href="#/settings"
      class="tab tab-icon"
      class:active={$currentRoute === '/settings'}
      title="Settings"
    >
      ⚙
    </a>
  </nav>

  <div class="main-area">
    {#if showSidebar}
      <Sidebar bind:collapsed on:toggle={handleSidebarToggle} />
    {/if}

    <main class="content">
      <slot />
    </main>
  </div>

  <!-- Notifications -->
  {#if $notifications.length > 0}
    <div class="notifications">
      {#each $notifications as notification (notification.id)}
        <div class="notification notification-{notification.type}">
          <span class="notification-message">{notification.message}</span>
          {#if notification.dismissible}
            <button
              class="notification-dismiss"
              on:click={() => appStore.dismissNotification(notification.id)}
            >
              ×
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: var(--color-bg-primary, #1e1e1e);
    color: var(--color-text-primary, #ccc);
  }

  .tab-bar {
    display: flex;
    background: var(--color-bg-secondary, #2d2d2d);
    border-bottom: 1px solid var(--color-border-subtle, #1e1e1e);
    height: var(--tab-bar-height, 32px);
  }

  .tab {
    padding: 6px 12px;
    background: transparent;
    color: var(--color-text-secondary, #9d9d9d);
    border: none;
    cursor: pointer;
    font-weight: var(--font-weight-medium, 500);
    font-size: var(--font-size-xs, 11px);
    border-bottom: 2px solid transparent;
    transition: all var(--transition-fast, 100ms);
    text-decoration: none;
    display: flex;
    align-items: center;
  }

  .tab:hover {
    background: var(--color-bg-hover, #3d3d3d);
    color: var(--color-text-primary, #ccc);
  }

  .tab.active {
    color: var(--color-text-primary, #fff);
    border-bottom-color: var(--color-accent, #007acc);
  }

  .tab-spacer {
    flex: 1;
  }

  .tab-icon {
    font-size: var(--font-size-md, 14px);
  }

  .main-area {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  /* Notifications */
  .notifications {
    position: fixed;
    bottom: var(--spacing-4, 16px);
    right: var(--spacing-4, 16px);
    z-index: var(--z-toast, 700);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2, 8px);
    max-width: 400px;
  }

  .notification {
    display: flex;
    align-items: center;
    gap: var(--spacing-3, 12px);
    padding: var(--spacing-3, 12px) var(--spacing-4, 16px);
    border-radius: var(--radius-lg, 6px);
    box-shadow: var(--shadow-lg, 0 4px 8px rgba(0, 0, 0, 0.5));
    animation: slideIn 0.2s ease;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .notification-info {
    background: var(--color-info-bg, rgba(55, 148, 255, 0.15));
    border: 1px solid var(--color-info, #3794ff);
    color: var(--color-info, #3794ff);
  }

  .notification-success {
    background: var(--color-success-bg, rgba(78, 201, 176, 0.15));
    border: 1px solid var(--color-success, #4ec9b0);
    color: var(--color-success, #4ec9b0);
  }

  .notification-warning {
    background: var(--color-warning-bg, rgba(220, 220, 170, 0.15));
    border: 1px solid var(--color-warning, #dcdcaa);
    color: var(--color-warning, #dcdcaa);
  }

  .notification-error {
    background: var(--color-error-bg, rgba(241, 76, 76, 0.15));
    border: 1px solid var(--color-error, #f14c4c);
    color: var(--color-error, #f14c4c);
  }

  .notification-message {
    flex: 1;
    font-size: var(--font-size-sm, 12px);
  }

  .notification-dismiss {
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: var(--font-size-lg, 16px);
    padding: 0;
    line-height: 1;
    opacity: 0.7;
  }

  .notification-dismiss:hover {
    opacity: 1;
  }
</style>
