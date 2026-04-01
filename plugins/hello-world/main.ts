import Plugin, { runPlugin } from '@dotmatrixlabs/dotx-plugin-sdk';

class HelloWorld extends Plugin {
  async onLoad() {
    await this.ui.showToast({ message: 'Hello from plugin!', type: 'success' });
  }
}

runPlugin(HelloWorld);
