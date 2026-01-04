<script lang="ts">
  import '../app.css';
  import '../fonts.css';

  import { setupThemeContext } from '@typie/ui/context';

  let { children } = $props();

  setupThemeContext();
</script>

<div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;">
  {@render children()}
</div>
