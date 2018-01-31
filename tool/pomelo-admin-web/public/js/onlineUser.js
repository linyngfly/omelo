Ext.onReady(function(){

	Ext.BLANK_IMAGE_URL ='../ext-4.0.7-gpl/resources/themes/images/default/tree/s.gif'; 
	
	let userStore = Ext.create('Ext.data.Store', {
		id:'userStoreId',
		autoLoad:false,
		pageSize:5,
		fields:['serverId','username','loginTime','uid','address'],
		proxy: {
			type: 'memory',
			reader: {
				type: 'json',
				root: 'requests'
			}
		}
	});

	/**
	 * userGrid,detail users' message
	 */
	let userGrid=Ext.create('Ext.grid.Panel', {
		id:'userGridId',
		region:'center',
	    store: userStore,
	    columns:[
			{xtype:'rownumberer',width:50,sortable:false},
			{text:'serverId',width:150,dataIndex:'serverId'},
			{text:'userName',dataIndex:'username',width:200},
			{text:'uid',dataIndex:'uid',width:50},
			{text:'address',dataIndex:'address',width:200},
			{text:'loginTime',dataIndex:'loginTime',width:200}
		]
	});

	let viewport=new Ext.Viewport({
		layout:'border',
		items:[{
			region:'north',
			height:30,
			contentEl:onlineUsersInfo
		}, userGrid]
	});
});

let STATUS_INTERVAL = 5 * 1000; // 60 seconds
/*
socket.on('connect', function(){
	socket.emit('announce_web_client');
	socket.emit('webMessage', {method: 'getOnlineUser'});

	socket.on('getOnlineUser',function(msg){  
		let totalConnCount = msg.totalConnCount;
		let loginedCount = msg.loginedCount;
		let onlineUserList = msg.onlineUserList
		let store = Ext.getCmp('userGridId').getStore();
		contentUpdate(totalConnCount, loginedCount);
		store.loadData(onlineUserList);
	});
});*/

setInterval(function() {
	window.parent.client.request('onlineUser', null, function(err, msg) {
		if(err) {
			console.error('fail to request online user:');
			console.error(err);
			return;
		}

		let totalConnCount = 0, loginedCount = 0, info, list = [];
		for(let sid in msg) {
			info = msg[sid];
			totalConnCount += msg[sid].totalConnCount;
			loginedCount += msg[sid].loginedCount;
			let lists = msg[sid].loginedList;
			for(let i=0;i<lists.length;i++){
				list.push({
					address : lists[i].address,
					serverId : sid,
					username : lists[i].username,
					loginTime : new Date(lists[i].loginTime),
					uid : lists[i].uid
				});
			}
		}	

		contentUpdate(totalConnCount, loginedCount);

		let store = Ext.getCmp('userGridId').getStore();
		console.log(list);
		store.loadData(list);
	});
}, STATUS_INTERVAL);

function contentUpdate(totalConnCount, loginedCount){
	document.getElementById("totalConnCount").innerHTML = totalConnCount;
	document.getElementById("loginedCount").innerHTML = loginedCount;
}
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
