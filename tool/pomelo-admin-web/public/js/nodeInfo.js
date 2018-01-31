Ext.onReady(function(){

	Ext.BLANK_IMAGE_URL ='../ext-4.0.7-gpl/resources/themes/images/default/tree/s.gif'; 

	let nodeStore=Ext.create('Ext.data.Store',{
       id:'nodeStore',
       autoLoad:false,
       pageSize:5,
       fields:['time','serverId','serverType','pid','cpuAvg','memAvg','vsz','rss','usr','sys','gue'],
       proxy:{
       	type:'memory',
       	reader:{
       		type:'json',
       		root:'nodes'
       	}
       }
	});
	//nodes' detailed information
	let nodesPanel=Ext.create('Ext.grid.Panel',{
        id:'nodesPanel',
        // title:'nodesInformation',
        region:'north',
        store:nodeStore,
        autoScroll:true,
        height:300,
        columns:[
           {xtype:'rownumberer',width:40,sortable:false},
           {text:'time',width:150,sortable:true,dataIndex:'time'},
           {text:'serverId',width:150,sortable:true,dataIndex:'serverId'},
           {text:'serverType',width:80,sortable:true,dataIndex:'serverType'},
           {text:'pid',width:60,sortable:true,dataIndex:'pid'},
           {text:'cpu%',width:60,sortable:true,dataIndex:'cpuAvg'},
           {text:'mem%',width:60,sortable:true,dataIndex:'memAvg'},
           {text:'vsz',width:80,sortable:true,dataIndex:'vsz'},
           {text:'rss',width:80,sortable:true,dataIndex:'rss'},
           {text:'cpu(i/o)',
             columns:[
               {text:'usr',width:60,sortable:true,dataIndex:'usr'},
               {text:'sys',width:60,sortable:true,dataIndex:'sys'},
               {text:'gue',width:60,sortable:true,dataIndex:'gue'}
             ]
           }
        ],
        tbar:[{
          xtype:'button',
          text:'refresh',
          handler:refresh
         }]
	});

	//chart of nodes' detailed
	let chartPanel=Ext.create('Ext.panel.Panel',{
		id:'chartPanel',
		title:'realtimeInfo',
		region:'center'

	})
	let viewport=new Ext.Viewport({
		layout:'border',
		items:[nodesPanel,chartPanel]
	});

  refresh();
});
/*
socket.on('connect',function(){
     socket.emit('announce_web_client');
     socket.emit('webMessage',{method:'getProcessInfo'});
     // socket.emit('processInfo',{method:'getProcess'});
     socket.on('getProcessInfo',function(msg){
    let store=Ext.getCmp('nodesPanel').getStore();
    store.loadData(msg.data);
     });
});
*/
function refresh(){
   window.parent.client.request('nodeInfo', null, function(err, msg) {
    if(err) {
      console.error('fail to request node info:');
      console.error(err);
      return;
    }

    // compose display data
    let data = [];
    for(let id in msg) {
      data.push(msg[id]);
    }
    let store = Ext.getCmp('nodesPanel').getStore();
    store.loadData(data);
  });
}

