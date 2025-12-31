<script lang="ts">
  import '../app.css';

  import { setupThemeContext } from '@typie/ui/context';

  let { children } = $props();

  setupThemeContext();
</script>

{@render children()}
