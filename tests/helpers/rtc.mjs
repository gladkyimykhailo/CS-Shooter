// In-memory transport used to exercise the production peer clients.
export function rtcFixture(){
  const pcs=new Map();let sequence=0;
  class Channel{
    readyState='connecting';bufferedAmount=0;
    send(text){if(this.readyState!=='open')throw new Error('closed');queueMicrotask(()=>this.other.onmessage?.({data:text}));}
  }
  class RTC{
    constructor(){this.id=++sequence;pcs.set(this.id,this);this.iceGatheringState='complete';this.connectionState='new';this.listeners=new Map();}
    createDataChannel(){return this.channel=new Channel();}
    async createOffer(){return {type:'offer',sdp:`v=0\r\npeer=${this.id}`};}
    async createAnswer(){return {type:'answer',sdp:`v=0\r\npeer=${this.id}`};}
    async setLocalDescription(d){this.localDescription={...d,sdp:d.sdp+'\r\na=candidate:1 1 udp 2122260223 192.0.2.1 50000 typ host\r\n'};}
    async setRemoteDescription(d){
      this.remoteDescription=d;
      if(d.type==='answer'){
        const guest=pcs.get(Number(d.sdp.match(/peer=(\d+)/)[1]));
        const channel=new Channel();this.channel.other=channel;channel.other=this.channel;guest.channel=channel;
        guest.ondatachannel({channel});
        this.channel.readyState=channel.readyState='open';
        this.connectionState=guest.connectionState='connected';
        this.channel.onopen?.();channel.onopen?.();
      }
    }
    addEventListener(name,fn){this.listeners.set(name,fn);}
    removeEventListener(name){this.listeners.delete(name);}
    close(){
      if(this.connectionState==='closed')return;this.connectionState='closed';
      if(this.channel){this.channel.readyState='closed';const other=this.channel.other;if(other){other.readyState='closed';queueMicrotask(()=>other.onclose?.());}}
    }
  }
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  return {RTC,pcs,flush};
}
