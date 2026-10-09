const form=document.querySelector('#application-form');
const review=document.querySelector('#review');
form.addEventListener('submit',event=>{
 event.preventDefault();if(!form.reportValidity())return;
 const values=new FormData(form);
 document.querySelector('#summary').textContent=['イベント名：'+values.get('title'),'主催者：'+values.get('organizer'),'開催希望日：'+values.get('date'),'参加予定：'+values.get('people')+'人','目的：'+values.get('purpose')].join('\n\n');
 form.hidden=true;review.hidden=false;review.focus();
});
document.querySelector('#back').addEventListener('click',()=>{review.hidden=true;form.hidden=false;form.querySelector('input').focus();});
