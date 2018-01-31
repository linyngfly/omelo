let run = function(key, obj) {
	getClient(key, function() {
		console.log(obj);
	})
}

function getClient(key, obj) {

}

let n = 10000 * 10000;
let key = "test_";

let i = 1;
setInterval(function() {
	i++;
	let r = [];
	for (let j = 0; j < 1000; j++) {
		r.push({
			a: key + i
		})
	}
	run(key + i, r);
}, 10);