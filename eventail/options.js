function $(id) {
    return document.getElementById(id);
}

function save_options() {
    var items = {
        sensuApiHost: $('sensuApiHost').value,
        sensuApiPort: $('sensuApiPort').value,
        uchiwaHost:   $('uchiwaHost').value,
        uchiwaPort:   $('uchiwaPort').value,
        datacenter:   $('datacenter').value
    };
    setOptions(items, function() {
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function() {
            status.textContent = '';
        }, 750);
    });
}

function restore_options() {
    console.log('restore');
    getOptions(function(items) {
        console.log(items);
        $('sensuApiHost').value = items.sensuApiHost;
        $('sensuApiPort').value = items.sensuApiPort;
        $('uchiwaHost').value = items.uchiwaHost;
        $('uchiwaPort').value = items.uchiwaPort;
        $('datacenter').value = items.datacenter;
    });
}

document.addEventListener('DOMContentLoaded', restore_options);

;$('save').addEventListener('click', save_options)
