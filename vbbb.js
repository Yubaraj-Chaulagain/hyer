<script>
  const tbl = document.getElementById("tbl");
  tbl.style.display = "table";
document.getElementById("MembersSection").style.display = "none";

  const memberSearch = document.getElementById("memberSearch");

  

<input id="memberSearch" onkeyup="searchMembers()">

  
 {
  const q = memberSearch.value.toLowerCase();
  const filtered = members.filter(m =>
    Object.values(m).some(v => String(v).toLowerCase().includes(q))
  );
  drawMembers(filtered);
});
</script>
