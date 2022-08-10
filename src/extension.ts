import * as vscode from 'vscode';

const ENDPOINT = 'https://app.unleash.team';

export function activate(context: vscode.ExtensionContext) {

	const provider = new UnleashViewProvider(context);

	// FOR TESTING since we have log off:
	// context.globalState.update('session',null);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(UnleashViewProvider.viewType, provider,{webviewOptions:{retainContextWhenHidden:true}}));

	
		context.subscriptions.push(vscode.window.registerUriHandler(new UnleashUriHandler(context)));	


	
	context.subscriptions.push(vscode.commands.registerCommand('unleash.search',c=>{
		vscode.commands.executeCommand("unleash-search.focus")
	}));
}


class UnleashUriHandler implements vscode.UriHandler{
	
	constructor(private context: vscode.ExtensionContext)
	{

	}
	handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
		let token = uri.query.split('token=')[1];
		let s = JSON.parse(unescape( token));
		this.context.globalState.update('session', s);
		UnleashViewProvider._view?.webview.postMessage({type:'unleash:vsc:session',session:s});
	}

}
class UnleashViewProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'unleash-search';

	public static _view?: vscode.WebviewView;

	constructor(
		private readonly _extension: vscode.ExtensionContext,
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		UnleashViewProvider._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extension.extensionUri
			]
		};

		webviewView.webview.onDidReceiveMessage(async data => {
			switch (data.type) {
				case 'unleash:vsc:openurl':
					{
						vscode.env.openExternal( vscode.Uri.parse( data.url ) );
						return;
					}
				case 'unleash:vsc:signin':
					{
						vscode.env.openExternal( vscode.Uri.parse( ENDPOINT+'/desktop?target=' + vscode.env.uriScheme ) );
						return;
					}

				case 'unleash:vsc:init':
					{
						webviewView.webview.postMessage({type:'unleash:vsc:session',session:await this._extension.globalState.get('session')})
						return;
					}
			}
		});
		
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

	
	}


	private _getHtmlForWebview(webview: vscode.Webview) {

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
			
			</head>
			<body>

				<div id='signin' style='display:none'>
					<div style='margin-bottom:10px;text-align:center'>Please sign in to your Unleash Account</div>
				 	<button onclick='vscode.postMessage({type:"unleash:vsc:signin"})'> Sign In </button>
				</div>

				<script>				
				
				let promRes;
				let prom = new Promise((res,rej)=>{ promRes = res });

				const vscode = acquireVsCodeApi();

				window.onmessage=e=>{
					
					if ( e.data.type == 'unleash:vsc:session')
					{
						promRes(e.data.session);						
						prom = new Promise((res,rej)=>{ promRes = res });
					}
				}

				const sc = document.createElement('script');
				sc.src = '${ENDPOINT}/embed-sdk.js';
				
				window.unleash = window.unleash || {
				  ready: function (c) {
					this.q.push(c);
				  },
				  q: [],
				};
				const psc = document.getElementsByTagName('script')[0];
				psc.parentNode.insertBefore(sc, psc);
		  
				unleash.ready(async () => {
				  const embed = await unleash.embed.create({
					id: 'extension:vsode',
					endpoint: '${ENDPOINT}',
					popup: {
					  hideOnClickOut: false,
		  
					  history: {
						url: '#isearch',
					  },
					  position: {x:'0px',y:'0px'},
					  size: { height:'100vh',width:'100vw' },
					  background:{color:'transparent'},
					  opacity: 0.7,
					  vibrancy: 4,
					  borderRadius: 10,
					  resizable: false,
					  moveable: false,
					  externalOpenUrl:true,
					  style: 'window',					  
					  theme: 'dark',					  
					  expandMode: 'external',
					},
					inline: {
					  history: {
						url: '#search',
					  },
					  position: { y: 0 },
					  sidebar: {
						workspaceIcon: false,
						style: 'hidden',
						allowUserToResize: false,
					  },
					  theme: 'dark',
					  size: {width:'100vw',height:'100vh'}
					},
				  });
		  				 
				embed.onOpenUrl = u =>{					
					vscode.postMessage({type:'unleash:vsc:openurl',url:u});
				}
				let ready = false;

				window.onfocus = ()=>{
					if (ready ) embed.show();	
				}

				  let handler = async session=>{
					
					if ( !session )
					{
						
						document.getElementById('signin').style.display='block';
						prom.then(handler);
					}
					else {
						document.getElementById('signin').style.display='none';
						await embed.signIn({session});
						ready=true;
						embed.show({mode: 'popup'});
					}
				  }

				  prom.then(handler);
				  vscode.postMessage({type:'unleash:vsc:init'});

				});
				</script>

			</body>
			</html>`;
	}
}
